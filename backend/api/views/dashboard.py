from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import connection
from datetime import date


class DashboardStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        project_id = request.query_params.get('project_id')
        if not project_id:
            return Response({'error': 'project_id is required'}, status=400)

        today = date.today()

        with connection.cursor() as c:
            # ── Active Sprint ──────────────────────────────────────────────
            c.execute("""
                SELECT id, name, goal, start_date, end_date
                FROM sprints
                WHERE project_id = %s AND status = 'active'
                ORDER BY start_date DESC
                LIMIT 1
            """, [project_id])
            row = c.fetchone()
            sprint_data = None
            if row:
                sprint_id, s_name, s_goal, s_start, s_end = row
                days_remaining = max(0, (s_end - today).days) if s_end else 0

                c.execute("""
                    SELECT
                        COALESCE(SUM(bi.story_points), 0) AS total_points,
                        COALESCE(SUM(CASE WHEN si.status = 'done' THEN bi.story_points ELSE 0 END), 0) AS done_points,
                        SUM(CASE WHEN si.status = 'todo'       THEN 1 ELSE 0 END) AS todo,
                        SUM(CASE WHEN si.status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress,
                        SUM(CASE WHEN si.status = 'in_review'  THEN 1 ELSE 0 END) AS in_review,
                        SUM(CASE WHEN si.status = 'done'       THEN 1 ELSE 0 END) AS done
                    FROM sprint_items si
                    JOIN backlog_items bi ON bi.id = si.backlog_item_id
                    WHERE si.sprint_id = %s
                """, [sprint_id])
                sc = c.fetchone()
                total_pts = float(sc[0]) if sc[0] else 0
                done_pts  = float(sc[1]) if sc[1] else 0
                todo_cnt  = int(sc[2]) if sc[2] else 0
                inp_cnt   = int(sc[3]) if sc[3] else 0
                rev_cnt   = int(sc[4]) if sc[4] else 0
                done_cnt  = int(sc[5]) if sc[5] else 0

                progress_pct = round((done_pts / total_pts * 100) if total_pts else 0, 1)

                # Expected % based on elapsed days
                total_days = max(1, (s_end - s_start).days) if (s_end and s_start) else 1
                elapsed    = max(0, (today - s_start).days) if s_start else 0
                expected_pct = round(min(100, elapsed / total_days * 100), 1)

                # Health
                if progress_pct >= expected_pct - 10:
                    health = 'on_track'
                elif progress_pct >= expected_pct - 25:
                    health = 'at_risk'
                else:
                    health = 'off_track'

                sprint_data = {
                    'name': s_name,
                    'goal': s_goal or '',
                    'start_date': s_start.isoformat() if s_start else None,
                    'end_date': s_end.isoformat() if s_end else None,
                    'days_remaining': days_remaining,
                    'done_points': done_pts,
                    'total_points': total_pts,
                    'progress_pct': progress_pct,
                    'expected_pct': expected_pct,
                    'health': health,
                    'todo': todo_cnt,
                    'in_progress': inp_cnt,
                    'in_review': rev_cnt,
                    'done': done_cnt,
                }

            # ── Backlog ────────────────────────────────────────────────────
            c.execute("""
                SELECT
                    COUNT(*) AS total,
                    SUM(CASE WHEN status = 'ready' THEN 1 ELSE 0 END) AS ready,
                    SUM(CASE WHEN status = 'in_sprint' THEN 1 ELSE 0 END) AS in_sprint
                FROM backlog_items
                WHERE project_id = %s AND status NOT IN ('done', 'cancelled')
            """, [project_id])
            br = c.fetchone()
            backlog_data = {
                'total':    int(br[0]) if br[0] else 0,
                'ready':    int(br[1]) if br[1] else 0,
                'in_sprint': int(br[2]) if br[2] else 0,
            }

            # ── Bugs ───────────────────────────────────────────────────────
            c.execute("""
                SELECT
                    SUM(CASE WHEN status NOT IN ('closed','resolved') THEN 1 ELSE 0 END) AS open_count,
                    SUM(CASE WHEN severity = 'critical' AND status NOT IN ('closed','resolved') THEN 1 ELSE 0 END) AS critical_open,
                    SUM(CASE WHEN due_date < %s AND status NOT IN ('closed','resolved') THEN 1 ELSE 0 END) AS sla_breached
                FROM bugs
                WHERE project_id = %s
            """, [today, project_id])
            bugr = c.fetchone()

            c.execute("""
                SELECT bug_id, title, severity, status, due_date
                FROM bugs
                WHERE project_id = %s AND severity = 'critical' AND status NOT IN ('closed','resolved')
                ORDER BY created_at DESC
                LIMIT 5
            """, [project_id])
            critical_bugs = [
                {'bug_id': r[0], 'title': r[1], 'severity': r[2], 'status': r[3],
                 'due_date': r[4].isoformat() if r[4] else None}
                for r in c.fetchall()
            ]
            bugs_data = {
                'open_count':    int(bugr[0]) if bugr[0] else 0,
                'critical_open': int(bugr[1]) if bugr[1] else 0,
                'sla_breached':  int(bugr[2]) if bugr[2] else 0,
                'critical_bugs': critical_bugs,
            }

            # ── Release ────────────────────────────────────────────────────
            release_data = None
            try:
                c.execute("""
                    SELECT name, version, status, planned_date
                    FROM releases
                    WHERE project_id = %s AND status NOT IN ('released','cancelled')
                    ORDER BY planned_date ASC
                    LIMIT 1
                """, [project_id])
                rr = c.fetchone()
                if rr:
                    planned = rr[3]
                    days_to = (planned - today).days if planned else None
                    release_data = {
                        'name': rr[0],
                        'version': rr[1],
                        'status': rr[2],
                        'days_to_release': days_to,
                    }
            except Exception:
                pass  # releases table may not exist

            # ── Velocity (last 6 completed sprints) ────────────────────────
            c.execute("""
                SELECT s.name,
                       COALESCE(SUM(CASE WHEN si.status = 'done' THEN bi.story_points ELSE 0 END), 0) AS done_points,
                       COALESCE(SUM(bi.story_points), 0) AS total_points
                FROM sprints s
                LEFT JOIN sprint_items si ON si.sprint_id = s.id
                LEFT JOIN backlog_items bi ON bi.id = si.backlog_item_id
                WHERE s.project_id = %s AND s.status = 'completed'
                GROUP BY s.id, s.name, s.end_date
                ORDER BY s.end_date DESC
                LIMIT 6
            """, [project_id])
            velocity_rows = c.fetchall()
            velocity = [
                {'sprint_name': r[0], 'done_points': float(r[1]), 'total_points': float(r[2])}
                for r in reversed(velocity_rows)
            ]

            # ── Grooming ───────────────────────────────────────────────────
            grooming_data = {'in_review': 0, 'draft': 0, 'approved': 0}
            try:
                c.execute("""
                    SELECT
                        SUM(CASE WHEN status = 'in_review' THEN 1 ELSE 0 END) AS in_review,
                        SUM(CASE WHEN status = 'draft'     THEN 1 ELSE 0 END) AS draft,
                        SUM(CASE WHEN status = 'approved'  THEN 1 ELSE 0 END) AS approved
                    FROM grooming_sessions
                    WHERE project_id = %s
                """, [project_id])
                gr = c.fetchone()
                if gr:
                    grooming_data = {
                        'in_review': int(gr[0]) if gr[0] else 0,
                        'draft':     int(gr[1]) if gr[1] else 0,
                        'approved':  int(gr[2]) if gr[2] else 0,
                    }
            except Exception:
                pass  # grooming table may not exist

        return Response({
            'sprint':   sprint_data,
            'backlog':  backlog_data,
            'bugs':     bugs_data,
            'release':  release_data,
            'velocity': velocity,
            'grooming': grooming_data,
        })
