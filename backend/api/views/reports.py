from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import connection


class VelocityView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        project_id = request.query_params.get('project_id')
        with connection.cursor() as c:
            sql = """
                SELECT s.id, s.name, s.start_date, s.end_date,
                       COUNT(si.id) AS total_items,
                       COALESCE(SUM(bi.story_points),0) AS total_points,
                       COALESCE(SUM(CASE WHEN bi.status='done' THEN bi.story_points ELSE 0 END),0) AS completed_points
                FROM sprints s
                LEFT JOIN sprint_items si ON si.sprint_id = s.id
                LEFT JOIN backlog_items bi ON bi.id = si.backlog_item_id
                WHERE s.status = 'completed'
            """
            params = []
            if project_id:
                sql += " AND s.project_id = %s"
                params.append(project_id)
            sql += " GROUP BY s.id ORDER BY s.end_date DESC LIMIT 10"
            c.execute(sql, params)
            cols = [d[0] for d in c.description]
            rows = [dict(zip(cols, row)) for row in c.fetchall()]
        return Response(rows)


class SprintStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        project_id = request.query_params.get('project_id')
        with connection.cursor() as c:
            sql = """
                SELECT s.id, s.name, s.status, s.start_date, s.end_date,
                       DATEDIFF(s.end_date, s.start_date) AS duration_days,
                       COUNT(DISTINCT sm.emis_user_id) AS team_size,
                       COUNT(si.id) AS total_items
                FROM sprints s
                LEFT JOIN sprint_members sm ON sm.sprint_id = s.id
                LEFT JOIN sprint_items si ON si.sprint_id = s.id
            """
            params = []
            if project_id:
                sql += " WHERE s.project_id = %s"
                params.append(project_id)
            sql += " GROUP BY s.id ORDER BY s.created_at DESC"
            c.execute(sql, params)
            cols = [d[0] for d in c.description]
            rows = [dict(zip(cols, row)) for row in c.fetchall()]
        return Response(rows)


class BugTrendView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        project_id = request.query_params.get('project_id')
        with connection.cursor() as c:
            sql = """
                SELECT DATE_FORMAT(created_at, '%Y-%m') AS month,
                       COUNT(*) AS total,
                       SUM(CASE WHEN status='closed' THEN 1 ELSE 0 END) AS closed
                FROM bugs
            """
            params = []
            if project_id:
                sql += " WHERE project_id = %s"
                params.append(project_id)
            sql += " GROUP BY month ORDER BY month DESC LIMIT 6"
            c.execute(sql, params)
            cols = [d[0] for d in c.description]
            rows = [dict(zip(cols, row)) for row in c.fetchall()]
        return Response(rows)


class TeamStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        with connection.cursor() as c:
            c.execute("""
                SELECT u.id, u.name, u.role,
                       COUNT(DISTINCT bi.id) AS backlog_items,
                       COUNT(DISTINCT b.id)  AS bugs_assigned
                FROM users u
                LEFT JOIN backlog_items bi ON bi.assigned_to = u.id AND bi.status = 'done'
                LEFT JOIN bugs b ON b.assigned_to = u.id
                WHERE u.status = 'active'
                GROUP BY u.id
                ORDER BY backlog_items DESC
                LIMIT 20
            """)
            cols = [d[0] for d in c.description]
            rows = [dict(zip(cols, row)) for row in c.fetchall()]
        return Response(rows)
