from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import connection
from datetime import date


class CTOOverviewView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = date.today()

        with connection.cursor() as c:
            # ── Summary counts ──────────────────────────────
            c.execute("SELECT COUNT(*) FROM projects WHERE status='active'")
            total_projects = c.fetchone()[0]

            c.execute("SELECT COUNT(*) FROM sprints WHERE status='active'")
            active_sprints = c.fetchone()[0]

            c.execute("SELECT COUNT(*) FROM bugs WHERE status NOT IN ('closed','resolved')")
            open_bugs = c.fetchone()[0]

            c.execute("SELECT COUNT(*) FROM bugs WHERE severity='critical' AND status NOT IN ('closed','resolved')")
            critical_bugs = c.fetchone()[0]

            c.execute("SELECT COUNT(*) FROM bugs WHERE due_date < %s AND status NOT IN ('closed','resolved')", [today])
            sla_breached = c.fetchone()[0]

            c.execute("SELECT COUNT(*) FROM backlog_items WHERE status NOT IN ('done','cancelled')")
            total_backlog = c.fetchone()[0]

            c.execute("SELECT COUNT(*) FROM users WHERE status='active'")
            active_users = c.fetchone()[0]

            # ── Per-project health ─────────────────────────
            c.execute("""
                SELECT p.id, p.name, p.key_code,
                       s.id as sprint_id, s.name as sprint_name,
                       s.start_date, s.end_date, s.status as sprint_status,
                       COALESCE(SUM(bi.story_points), 0) as total_points,
                       COALESCE(SUM(CASE WHEN si.status='done' THEN bi.story_points ELSE 0 END), 0) as done_points,
                       COUNT(si.id) as total_items,
                       SUM(CASE WHEN si.status='done'        THEN 1 ELSE 0 END) as done_items,
                       SUM(CASE WHEN si.status='todo'        THEN 1 ELSE 0 END) as todo_items,
                       SUM(CASE WHEN si.status='in_progress' THEN 1 ELSE 0 END) as inprogress_items,
                       SUM(CASE WHEN si.status='in_review'   THEN 1 ELSE 0 END) as inreview_items
                FROM projects p
                LEFT JOIN sprints s ON s.project_id = p.id AND s.status = 'active'
                LEFT JOIN sprint_items si ON si.sprint_id = s.id
                LEFT JOIN backlog_items bi ON bi.id = si.backlog_item_id
                WHERE p.status = 'active'
                GROUP BY p.id, p.name, p.key_code, s.id, s.name, s.start_date, s.end_date, s.status
                ORDER BY p.name
            """)
            cols = [d[0] for d in c.description]
            project_rows = [dict(zip(cols, row)) for row in c.fetchall()]

            projects = []
            for pr in project_rows:
                total_pts = float(pr['total_points'])
                done_pts  = float(pr['done_points'])
                progress  = round((done_pts / total_pts * 100) if total_pts else 0, 1)

                days_remaining = None
                expected_pct   = 0
                health         = 'no_sprint'

                if pr['end_date'] and pr['start_date']:
                    days_remaining = max(0, (pr['end_date'] - today).days)
                    total_days     = max(1, (pr['end_date'] - pr['start_date']).days)
                    elapsed        = max(0, (today - pr['start_date']).days)
                    expected_pct   = round(min(100, elapsed / total_days * 100), 1)
                    if progress >= expected_pct - 10:
                        health = 'on_track'
                    elif progress >= expected_pct - 25:
                        health = 'at_risk'
                    else:
                        health = 'off_track'

                if   health == 'on_track':  score = min(100, 80 + (progress - expected_pct) * 0.5)
                elif health == 'at_risk':   score = 55
                elif health == 'off_track': score = 30
                else:                       score = 50
                score = max(0, min(100, round(score)))

                # bug counts
                c.execute("""
                    SELECT COUNT(*),
                           SUM(CASE WHEN severity='critical' THEN 1 ELSE 0 END),
                           SUM(CASE WHEN due_date < %s AND status NOT IN ('closed','resolved') THEN 1 ELSE 0 END)
                    FROM bugs WHERE project_id=%s AND status NOT IN ('closed','resolved')
                """, [today, pr['id']])
                br = c.fetchone()

                projects.append({
                    'id':       pr['id'],
                    'name':     pr['name'],
                    'key_code': pr['key_code'],
                    'sprint': {
                        'id':            pr['sprint_id'],
                        'name':          pr['sprint_name'],
                        'start_date':    pr['start_date'].isoformat() if pr['start_date'] else None,
                        'end_date':      pr['end_date'].isoformat()   if pr['end_date']   else None,
                        'days_remaining': days_remaining,
                        'total_points':  total_pts,
                        'done_points':   done_pts,
                        'progress':      progress,
                        'expected_pct':  expected_pct,
                        'health':        health,
                        'todo':          int(pr['todo_items']      or 0),
                        'in_progress':   int(pr['inprogress_items']or 0),
                        'in_review':     int(pr['inreview_items']  or 0),
                        'done':          int(pr['done_items']      or 0),
                        'total':         int(pr['total_items']     or 0),
                    } if pr['sprint_id'] else None,
                    'bugs': {
                        'total':     int(br[0]) if br[0] else 0,
                        'critical':  int(br[1]) if br[1] else 0,
                        'sla_breach':int(br[2]) if br[2] else 0,
                    },
                    'health_score': score,
                })

            # ── Velocity (last 8 completed sprints) ────────
            c.execute("""
                SELECT s.id, s.name, p.name as project_name, s.end_date,
                       COALESCE(SUM(CASE WHEN si.status='done' THEN bi.story_points ELSE 0 END),0) as done_points,
                       COALESCE(SUM(bi.story_points),0) as total_points
                FROM sprints s
                JOIN projects p ON p.id = s.project_id
                LEFT JOIN sprint_items si ON si.sprint_id = s.id
                LEFT JOIN backlog_items bi ON bi.id = si.backlog_item_id
                WHERE s.status = 'completed'
                GROUP BY s.id, s.name, p.name, s.end_date
                ORDER BY s.end_date DESC LIMIT 8
            """)
            vcols = [d[0] for d in c.description]
            velocity = [dict(zip(vcols, r)) for r in c.fetchall()]
            for v in velocity:
                v['done_points']  = float(v['done_points'])
                v['total_points'] = float(v['total_points'])
                if v.get('end_date'): v['end_date'] = v['end_date'].isoformat()
            velocity.reverse()

            # ── Avg velocity ──────────────────────────────
            c.execute("""
                SELECT AVG(dp) FROM (
                    SELECT COALESCE(SUM(CASE WHEN si.status='done' THEN bi.story_points ELSE 0 END),0) as dp
                    FROM sprints s
                    LEFT JOIN sprint_items si ON si.sprint_id = s.id
                    LEFT JOIN backlog_items bi ON bi.id = si.backlog_item_id
                    WHERE s.status='completed'
                    GROUP BY s.id
                ) t
            """)
            avg_velocity = round(float(c.fetchone()[0] or 0), 1)

            # ── Bug distribution ──────────────────────────
            c.execute("SELECT severity, COUNT(*) FROM bugs WHERE status NOT IN ('closed','resolved') GROUP BY severity")
            bug_severity = {r[0]: int(r[1]) for r in c.fetchall()}
            c.execute("SELECT status, COUNT(*) FROM bugs GROUP BY status")
            bug_status = {r[0]: int(r[1]) for r in c.fetchall()}

            # ── Monthly bug trend (last 6 months) ─────────
            c.execute("""
                SELECT DATE_FORMAT(created_at,'%Y-%m') as month,
                       COUNT(*) as reported,
                       SUM(CASE WHEN status='closed' THEN 1 ELSE 0 END) as closed
                FROM bugs GROUP BY month ORDER BY month DESC LIMIT 6
            """)
            bug_trend = [{'month': r[0], 'reported': int(r[1]), 'closed': int(r[2])} for r in c.fetchall()]
            bug_trend.reverse()

            # ── Requirements stats ────────────────────────
            req_stats = {'total': 0, 'approved': 0, 'draft': 0, 'review': 0}
            try:
                c.execute("SELECT status, COUNT(*) FROM requirements GROUP BY status")
                for r in c.fetchall():
                    req_stats[r[0]] = int(r[1])
                req_stats['total'] = sum(req_stats.values())
            except Exception:
                pass

            # ── Grooming stats ────────────────────────────
            grooming_stats = {'in_review': 0, 'draft': 0, 'approved': 0, 'total': 0}
            try:
                c.execute("SELECT status, COUNT(*) FROM grooming_sessions GROUP BY status")
                for r in c.fetchall():
                    grooming_stats[r[0]] = int(r[1])
                grooming_stats['total'] = sum(v for k, v in grooming_stats.items() if k != 'total')
            except Exception:
                pass

            # ── Releases stats ────────────────────────────
            release_stats = {'total': 0, 'in_progress': 0, 'released': 0, 'delayed': 0}
            try:
                c.execute("SELECT status, COUNT(*) FROM releases GROUP BY status")
                for r in c.fetchall():
                    release_stats[r[0]] = int(r[1])
                    release_stats['total'] += int(r[1])
                c.execute("SELECT COUNT(*) FROM releases WHERE planned_date < %s AND status NOT IN ('released','cancelled','failed')", [today])
                release_stats['delayed'] = int(c.fetchone()[0])
            except Exception:
                pass

            # ── Engineering health score ──────────────────
            total_with_sprint = sum(1 for p in projects if p['sprint'])
            on_track          = sum(1 for p in projects if p['sprint'] and p['sprint']['health'] == 'on_track')
            sprint_score      = (on_track / max(total_with_sprint, 1) * 100) if total_with_sprint else 50
            sla_score         = max(0, 100 - sla_breached * 20)
            vel_score         = min(100, (avg_velocity / 20 * 100)) if avg_velocity else 50
            eng_health        = round(sprint_score * 0.40 + sla_score * 0.30 + vel_score * 0.20 + 75 * 0.10, 1)

            # ── Risk items (AI-heuristic) ─────────────────
            risk_items = []
            for p in projects:
                s = p['sprint']
                if s:
                    dr = s.get('days_remaining')
                    if dr is not None and dr <= 3 and s['progress'] < 60:
                        risk_items.append({
                            'type': 'sprint_risk', 'severity': 'critical',
                            'project': p['name'],
                            'message': f"Sprint ends in {dr}d with {s['progress']}% done",
                            'action': 'Review scope or request extension'
                        })
                    elif s['health'] == 'off_track':
                        risk_items.append({
                            'type': 'sprint_risk', 'severity': 'high',
                            'project': p['name'],
                            'message': f"{s['progress']}% done vs {s['expected_pct']}% expected",
                            'action': 'Daily sync + unblock teams immediately'
                        })
                    elif s['health'] == 'at_risk':
                        risk_items.append({
                            'type': 'sprint_risk', 'severity': 'medium',
                            'project': p['name'],
                            'message': f"Sprint tracking slightly behind schedule",
                            'action': 'Monitor closely and remove impediments'
                        })
                if p['bugs']['critical'] > 0:
                    risk_items.append({
                        'type': 'bug_risk', 'severity': 'critical',
                        'project': p['name'],
                        'message': f"{p['bugs']['critical']} critical bug(s) open",
                        'action': 'Escalate to engineering lead'
                    })
                if p['bugs']['sla_breach'] > 0:
                    risk_items.append({
                        'type': 'sla_breach', 'severity': 'high',
                        'project': p['name'],
                        'message': f"{p['bugs']['sla_breach']} bug(s) SLA breached",
                        'action': 'Assign resources immediately'
                    })

        return Response({
            'summary': {
                'total_projects':   total_projects,
                'active_sprints':   active_sprints,
                'open_bugs':        open_bugs,
                'critical_bugs':    critical_bugs,
                'sla_breached':     sla_breached,
                'total_backlog':    total_backlog,
                'active_users':     active_users,
                'avg_velocity':     avg_velocity,
                'engineering_health': eng_health,
            },
            'projects':  projects,
            'velocity':  velocity,
            'bugs': {
                'by_severity': bug_severity,
                'by_status':   bug_status,
                'trend':       bug_trend,
            },
            'requirements': req_stats,
            'grooming':     grooming_stats,
            'releases':     release_stats,
            'risk_items':   risk_items,
        })
