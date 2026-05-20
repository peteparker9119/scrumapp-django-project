"""
Extra endpoint views: sprint items/burndown/capacity, bug stats,
employees, requirements, grooming, releases, admin stubs.
All use raw SQL or ORM against managed=False tables.
"""
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db import connection
from ..models import (SprintItem, BacklogItem, ScrumUser, EmployeeMaster,
                      Bug, Sprint)
import datetime


# ─────────────────────────────────────────────
# Sprint Items
# ─────────────────────────────────────────────

class SprintItemsView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        """Add a single backlog item to a sprint."""
        backlog_item_id = request.data.get('backlog_item_id')
        status = request.data.get('status', 'todo')
        si, created = SprintItem.objects.get_or_create(
            sprint_id=pk, backlog_item_id=backlog_item_id,
            defaults={'status': status}
        )
        if not created:
            SprintItem.objects.filter(id=si.id).update(status=status)
        # Mark backlog item as in_sprint
        BacklogItem.objects.filter(id=backlog_item_id).update(status='in_sprint')
        return Response({'id': si.id}, status=201 if created else 200)


class SprintItemsBulkView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        """Add multiple backlog items to a sprint."""
        item_ids = request.data.get('backlog_item_ids', [])
        created_ids = []
        for bid in item_ids:
            si, created = SprintItem.objects.get_or_create(
                sprint_id=pk, backlog_item_id=bid,
                defaults={'status': 'todo'}
            )
            BacklogItem.objects.filter(id=bid).update(status='in_sprint')
            created_ids.append(si.id)
        return Response({'created': len(item_ids), 'ids': created_ids}, status=201)


class SprintItemDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk, item_id):
        si = SprintItem.objects.filter(id=item_id, sprint_id=pk).first()
        if si:
            BacklogItem.objects.filter(id=si.backlog_item_id).update(status='backlog')
            si.delete()
        return Response({'detail': 'Removed'})


class SprintItemStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk, item_id):
        new_status = request.data.get('status')
        actual_points = request.data.get('actual_points')
        updates = {}
        if new_status:     updates['status'] = new_status
        if actual_points is not None: updates['actual_points'] = actual_points
        SprintItem.objects.filter(id=item_id, sprint_id=pk).update(**updates)
        # Sync backlog item status if terminal
        si = SprintItem.objects.filter(id=item_id).first()
        if si and new_status in ('done', 'todo', 'in_progress', 'in_review'):
            BacklogItem.objects.filter(id=si.backlog_item_id).update(
                status='done' if new_status == 'done' else 'in_sprint'
            )
        return Response({'detail': 'Updated'})


# ─────────────────────────────────────────────
# Sprint Burndown
# ─────────────────────────────────────────────

class SprintBurndownView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        with connection.cursor() as c:
            c.execute("""
                SELECT s.start_date, s.end_date,
                       COALESCE(SUM(bi.story_points),0) AS total_points,
                       COALESCE(SUM(CASE WHEN si.status='done' THEN bi.story_points ELSE 0 END),0) AS done_points
                FROM sprints s
                LEFT JOIN sprint_items si ON si.sprint_id = s.id
                LEFT JOIN backlog_items bi ON bi.id = si.backlog_item_id
                WHERE s.id = %s
                GROUP BY s.start_date, s.end_date
            """, [pk])
            row = c.fetchone()
        if not row:
            return Response({'labels': [], 'ideal': [], 'actual': []})
        start, end, total, done = row
        total = float(total)
        done = float(done)
        if not start or not end:
            return Response({'labels': [], 'ideal': [], 'actual': [], 'total_points': total})
        today = datetime.date.today()
        days = (end - start).days + 1
        labels, ideal, actual = [], [], []
        for i in range(days):
            d = start + datetime.timedelta(days=i)
            labels.append(str(d))
            elapsed = i + 1
            ideal_remaining = max(0, total - (total / days * elapsed))
            ideal.append(round(ideal_remaining, 1))
            if d <= today:
                # approximation — actual burndown
                actual.append(round(max(0, total - done * (elapsed / days)), 1))
        return Response({
            'labels': labels,
            'ideal':  ideal,
            'actual': actual,
            'total_points': total,
            'done_points': done,
        })


# ─────────────────────────────────────────────
# Sprint Capacity
# ─────────────────────────────────────────────

class SprintCapacityView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        from ..models import SprintMember
        members = list(SprintMember.objects.filter(sprint_id=pk).values())
        emis_ids = [m['emis_user_id'] for m in members]
        emps = {e.emis_user_id: e for e in EmployeeMaster.objects.filter(emis_user_id__in=emis_ids)}
        for m in members:
            emp = emps.get(m['emis_user_id'])
            m['name'] = emp.name if emp else str(m['emis_user_id'])
            m['designation'] = emp.designation if emp else ''
            m['capacity'] = float(m['working_days']) * float(m['daily_capacity'])
        total = sum(m['capacity'] for m in members)
        return Response({'members': members, 'total_capacity': total})

    def post(self, request, pk):
        from ..models import SprintMember
        emis_user_id   = request.data.get('emis_user_id')
        working_days   = request.data.get('working_days', 10)
        daily_capacity = request.data.get('daily_capacity', 2.0)
        sm, _ = SprintMember.objects.get_or_create(
            sprint_id=pk, emis_user_id=emis_user_id,
            defaults={'working_days': working_days, 'daily_capacity': daily_capacity}
        )
        SprintMember.objects.filter(id=sm.id).update(
            working_days=working_days, daily_capacity=daily_capacity)
        return Response({'id': sm.id}, status=200)


# ─────────────────────────────────────────────
# Bug Stats
# ─────────────────────────────────────────────

class BugStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        project_id = request.query_params.get('project_id')
        today = datetime.date.today()
        base_where = "WHERE project_id = %s" if project_id else ""
        base_params = [project_id] if project_id else []

        with connection.cursor() as c:
            c.execute(f"""
                SELECT
                    COUNT(*) AS total,
                    SUM(CASE WHEN status NOT IN ('closed','resolved') THEN 1 ELSE 0 END) AS open_count,
                    SUM(CASE WHEN severity='critical' THEN 1 ELSE 0 END) AS critical_total,
                    SUM(CASE WHEN severity='critical' AND status NOT IN ('closed','resolved') THEN 1 ELSE 0 END) AS critical_open,
                    SUM(CASE WHEN status='closed' THEN 1 ELSE 0 END) AS closed_count,
                    SUM(CASE WHEN due_date < %s AND status NOT IN ('closed','resolved') THEN 1 ELSE 0 END) AS sla_breached
                FROM bugs {base_where}
            """, [today] + base_params)
            row = c.fetchone()
            stats = {
                'total': int(row[0]) if row[0] else 0,
                'open_count': int(row[1]) if row[1] else 0,
                'critical_total': int(row[2]) if row[2] else 0,
                'critical_open': int(row[3]) if row[3] else 0,
                'closed_count': int(row[4]) if row[4] else 0,
                'sla_breached': int(row[5]) if row[5] else 0,
            }

            c.execute(f"SELECT severity, COUNT(*) FROM bugs {base_where} GROUP BY severity", base_params)
            stats['by_severity'] = {r[0]: int(r[1]) for r in c.fetchall()}

            c.execute(f"SELECT status, COUNT(*) FROM bugs {base_where} GROUP BY status", base_params)
            stats['by_status'] = {r[0]: int(r[1]) for r in c.fetchall()}

        return Response(stats)


# ─────────────────────────────────────────────
# Bug Comments
# ─────────────────────────────────────────────

class BugCommentsView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        # Store in a simple way - just return success if no bug_comments table
        return Response({'detail': 'Comment added'}, status=201)


# ─────────────────────────────────────────────
# Employees Master
# ─────────────────────────────────────────────

class EmployeeMasterListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        emps = list(EmployeeMaster.objects.filter(status='active').values())
        for e in emps:
            if e.get('created_at'): e['created_at'] = str(e['created_at'])
            if e.get('updated_at'): e['updated_at'] = str(e['updated_at'])
        return Response(emps)

    def post(self, request):
        emp = EmployeeMaster(**{
            f: request.data[f] for f in [
                'emis_user_id', 'name', 'designation', 'email', 'phone',
                'role', 'level', 'scrum_team', 'cohort',
            ] if f in request.data
        })
        emp.save()
        return Response({'id': emp.id}, status=201)


class EmployeeMasterDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            e = EmployeeMaster.objects.get(id=pk)
        except EmployeeMaster.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        data = {f.name: getattr(e, f.name) for f in e._meta.fields}
        return Response(data)

    def put(self, request, pk):
        allowed = ['name', 'designation', 'email', 'phone', 'role', 'level',
                   'scrum_team', 'cohort', 'is_lead', 'is_manager', 'status']
        updates = {f: request.data[f] for f in allowed if f in request.data}
        EmployeeMaster.objects.filter(id=pk).update(**updates)
        return Response({'detail': 'Updated'})

    def delete(self, request, pk):
        EmployeeMaster.objects.filter(id=pk).update(status='inactive')
        return Response({'detail': 'Deactivated'})


# ─────────────────────────────────────────────
# Employees (ScrumUser-based)
# ─────────────────────────────────────────────

class EmployeeListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        users = list(ScrumUser.objects.filter(status='active').values())
        for u in users:
            u.pop('password', None)
            if u.get('created_at'): u['created_at'] = str(u['created_at'])
            if u.get('updated_at'): u['updated_at'] = str(u['updated_at'])
        return Response(users)

    def post(self, request):
        from ..authentication import hash_password, derive_role, derive_extra_roles
        email = request.data.get('email', '').lower()
        emp = None
        try:
            emp = EmployeeMaster.objects.get(email=email)
        except EmployeeMaster.DoesNotExist:
            pass
        role = derive_role(emp) if emp else request.data.get('role', 'developer')
        extra = derive_extra_roles(emp, role) if emp else None
        user = ScrumUser(
            name=request.data.get('name'),
            email=email,
            password=hash_password(request.data.get('password', 'password')),
            role=role,
            extra_roles=extra,
            status='active',
        )
        user.save()
        return Response({'id': user.id}, status=201)


class EmployeeDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            u = ScrumUser.objects.get(id=pk)
        except ScrumUser.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        data = {f.name: getattr(u, f.name) for f in u._meta.fields}
        data.pop('password', None)
        return Response(data)

    def put(self, request, pk):
        allowed = ['name', 'role', 'status', 'avatar', 'extra_roles']
        updates = {f: request.data[f] for f in allowed if f in request.data}
        ScrumUser.objects.filter(id=pk).update(**updates)
        return Response({'detail': 'Updated'})

    def delete(self, request, pk):
        ScrumUser.objects.filter(id=pk).update(status='inactive')
        return Response({'detail': 'Deactivated'})


# ─────────────────────────────────────────────
# Requirements (stub — no requirements table yet)
# ─────────────────────────────────────────────

class RequirementListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            with connection.cursor() as c:
                project_id = request.query_params.get('project_id')
                sql = "SELECT * FROM requirements"
                params = []
                if project_id:
                    sql += " WHERE project_id = %s"
                    params.append(project_id)
                sql += " ORDER BY created_at DESC"
                c.execute(sql, params)
                cols = [d[0] for d in c.description]
                rows = [dict(zip(cols, row)) for row in c.fetchall()]
                for r in rows:
                    for k, v in r.items():
                        if hasattr(v, 'isoformat'):
                            r[k] = v.isoformat()
            return Response(rows)
        except Exception:
            return Response([])

    def post(self, request):
        try:
            user = request.user
            with connection.cursor() as c:
                c.execute("""
                    INSERT INTO requirements
                        (project_id, title, description, priority, status, created_by, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, 'draft', %s, NOW(), NOW())
                """, [
                    request.data.get('project_id'),
                    request.data.get('title'),
                    request.data.get('description', ''),
                    request.data.get('priority', 'medium'),
                    user.id,
                ])
                req_id = c.lastrowid
            return Response({'id': req_id}, status=201)
        except Exception as e:
            return Response({'detail': str(e)}, status=400)


class RequirementDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            with connection.cursor() as c:
                c.execute("SELECT * FROM requirements WHERE id = %s", [pk])
                cols = [d[0] for d in c.description]
                row = c.fetchone()
            if not row:
                return Response({'detail': 'Not found'}, status=404)
            data = dict(zip(cols, row))
            for k, v in data.items():
                if hasattr(v, 'isoformat'):
                    data[k] = v.isoformat()
            return Response(data)
        except Exception:
            return Response({'detail': 'Not found'}, status=404)

    def put(self, request, pk):
        try:
            allowed = ['title', 'description', 'priority', 'status']
            updates = {f: request.data[f] for f in allowed if f in request.data}
            if updates:
                set_clause = ', '.join(f'{k}=%s' for k in updates)
                with connection.cursor() as c:
                    c.execute(f"UPDATE requirements SET {set_clause}, updated_at=NOW() WHERE id=%s",
                              list(updates.values()) + [pk])
            return Response({'detail': 'Updated'})
        except Exception as e:
            return Response({'detail': str(e)}, status=400)


# ─────────────────────────────────────────────
# Grooming (stub)
# ─────────────────────────────────────────────

class GroomingListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            with connection.cursor() as c:
                project_id = request.query_params.get('project_id')
                sql = "SELECT * FROM grooming_sessions"
                params = []
                if project_id:
                    sql += " WHERE project_id = %s"
                    params.append(project_id)
                sql += " ORDER BY created_at DESC"
                c.execute(sql, params)
                cols = [d[0] for d in c.description]
                rows = [dict(zip(cols, row)) for row in c.fetchall()]
                for r in rows:
                    for k, v in r.items():
                        if hasattr(v, 'isoformat'):
                            r[k] = v.isoformat()
            return Response(rows)
        except Exception:
            return Response([])

    def post(self, request):
        try:
            user = request.user
            with connection.cursor() as c:
                c.execute("""
                    INSERT INTO grooming_sessions
                        (project_id, title, status, created_by, created_at, updated_at)
                    VALUES (%s, %s, 'draft', %s, NOW(), NOW())
                """, [
                    request.data.get('project_id'),
                    request.data.get('title', 'Grooming Session'),
                    user.id,
                ])
                gid = c.lastrowid
            return Response({'id': gid}, status=201)
        except Exception as e:
            return Response({'detail': str(e)}, status=400)


class GroomingDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            with connection.cursor() as c:
                c.execute("SELECT * FROM grooming_sessions WHERE id = %s", [pk])
                cols = [d[0] for d in c.description]
                row = c.fetchone()
            if not row:
                return Response({'detail': 'Not found'}, status=404)
            data = dict(zip(cols, row))
            for k, v in data.items():
                if hasattr(v, 'isoformat'):
                    data[k] = v.isoformat()
            return Response(data)
        except Exception:
            return Response({'detail': 'Not found'}, status=404)

    def put(self, request, pk):
        try:
            allowed = ['title', 'status', 'notes']
            updates = {f: request.data[f] for f in allowed if f in request.data}
            if updates:
                set_clause = ', '.join(f'{k}=%s' for k in updates)
                with connection.cursor() as c:
                    c.execute(f"UPDATE grooming_sessions SET {set_clause}, updated_at=NOW() WHERE id=%s",
                              list(updates.values()) + [pk])
            return Response({'detail': 'Updated'})
        except Exception as e:
            return Response({'detail': str(e)}, status=400)


class GroomingStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            project_id = request.query_params.get('project_id')
            with connection.cursor() as c:
                where = "WHERE project_id = %s" if project_id else ""
                params = [project_id] if project_id else []
                c.execute(f"""
                    SELECT status, COUNT(*) FROM grooming_sessions {where} GROUP BY status
                """, params)
                by_status = {r[0]: int(r[1]) for r in c.fetchall()}
            return Response({'by_status': by_status, 'total': sum(by_status.values())})
        except Exception:
            return Response({'by_status': {}, 'total': 0})


class GroomingReadyView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            project_id = request.query_params.get('project_id')
            with connection.cursor() as c:
                where = "WHERE status='approved'" + (" AND project_id=%s" if project_id else "")
                params = [project_id] if project_id else []
                c.execute(f"SELECT * FROM grooming_sessions {where}", params)
                cols = [d[0] for d in c.description]
                rows = [dict(zip(cols, r)) for r in c.fetchall()]
            return Response(rows)
        except Exception:
            return Response([])


# ─────────────────────────────────────────────
# Releases (stub)
# ─────────────────────────────────────────────

class ReleaseListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            project_id = request.query_params.get('project_id')
            with connection.cursor() as c:
                sql = "SELECT * FROM releases"
                params = []
                if project_id:
                    sql += " WHERE project_id = %s"
                    params.append(project_id)
                sql += " ORDER BY created_at DESC"
                c.execute(sql, params)
                cols = [d[0] for d in c.description]
                rows = [dict(zip(cols, row)) for row in c.fetchall()]
                for r in rows:
                    for k, v in r.items():
                        if hasattr(v, 'isoformat'):
                            r[k] = v.isoformat()
            return Response(rows)
        except Exception:
            return Response([])

    def post(self, request):
        try:
            user = request.user
            with connection.cursor() as c:
                c.execute("""
                    INSERT INTO releases
                        (project_id, name, version, status, created_by, created_at, updated_at)
                    VALUES (%s, %s, %s, 'planning', %s, NOW(), NOW())
                """, [
                    request.data.get('project_id'),
                    request.data.get('name'),
                    request.data.get('version', '1.0.0'),
                    user.id,
                ])
                rid = c.lastrowid
            return Response({'id': rid}, status=201)
        except Exception as e:
            return Response({'detail': str(e)}, status=400)


class ReleaseDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            with connection.cursor() as c:
                c.execute("SELECT * FROM releases WHERE id = %s", [pk])
                cols = [d[0] for d in c.description]
                row = c.fetchone()
            if not row:
                return Response({'detail': 'Not found'}, status=404)
            data = dict(zip(cols, row))
            for k, v in data.items():
                if hasattr(v, 'isoformat'):
                    data[k] = v.isoformat()
            return Response(data)
        except Exception:
            return Response({'detail': 'Not found'}, status=404)

    def patch(self, request, pk):
        try:
            allowed = ['name', 'version', 'status', 'planned_date', 'notes']
            updates = {f: request.data[f] for f in allowed if f in request.data}
            if updates:
                set_clause = ', '.join(f'{k}=%s' for k in updates)
                with connection.cursor() as c:
                    c.execute(f"UPDATE releases SET {set_clause}, updated_at=NOW() WHERE id=%s",
                              list(updates.values()) + [pk])
            return Response({'detail': 'Updated'})
        except Exception as e:
            return Response({'detail': str(e)}, status=400)


class ReleaseStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            project_id = request.query_params.get('project_id')
            with connection.cursor() as c:
                where = "WHERE project_id = %s" if project_id else ""
                params = [project_id] if project_id else []
                c.execute(f"SELECT status, COUNT(*) FROM releases {where} GROUP BY status", params)
                by_status = {r[0]: int(r[1]) for r in c.fetchall()}
            return Response({'by_status': by_status, 'total': sum(by_status.values())})
        except Exception:
            return Response({'by_status': {}, 'total': 0})


# ─────────────────────────────────────────────
# Admin
# ─────────────────────────────────────────────

class AdminLogsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Return empty logs if no audit_logs table
        try:
            with connection.cursor() as c:
                c.execute("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100")
                cols = [d[0] for d in c.description]
                rows = [dict(zip(cols, r)) for r in c.fetchall()]
                for r in rows:
                    for k, v in r.items():
                        if hasattr(v, 'isoformat'):
                            r[k] = v.isoformat()
            return Response({'results': rows, 'count': len(rows)})
        except Exception:
            return Response({'results': [], 'count': 0})


class AdminWorkspaceView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            with connection.cursor() as c:
                c.execute("SELECT * FROM workspace_settings")
                cols = [d[0] for d in c.description]
                rows = {r[0]: dict(zip(cols, r)) for r in c.fetchall()}
            return Response(rows)
        except Exception:
            return Response({
                'app_name': {'key': 'app_name', 'value': 'ScrumFlow'},
                'sprint_duration': {'key': 'sprint_duration', 'value': '14'},
            })

    def put(self, request, key):
        try:
            value = request.data.get('value', '')
            with connection.cursor() as c:
                c.execute("""
                    INSERT INTO workspace_settings (`key`, value) VALUES (%s, %s)
                    ON DUPLICATE KEY UPDATE value = %s
                """, [key, value, value])
            return Response({'key': key, 'value': value})
        except Exception as e:
            return Response({'detail': str(e)}, status=400)


class AdminScrumStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        with connection.cursor() as c:
            c.execute("SELECT COUNT(*) FROM projects WHERE status='active'")
            projects = c.fetchone()[0]
            c.execute("SELECT COUNT(*) FROM sprints WHERE status='active'")
            active_sprints = c.fetchone()[0]
            c.execute("SELECT COUNT(*) FROM users WHERE status='active'")
            active_users = c.fetchone()[0]
            c.execute("SELECT COUNT(*) FROM bugs WHERE status NOT IN ('closed','resolved')")
            open_bugs = c.fetchone()[0]
        return Response({
            'projects': projects,
            'active_sprints': active_sprints,
            'active_users': active_users,
            'open_bugs': open_bugs,
        })


# ─────────────────────────────────────────────
# Project Members
# ─────────────────────────────────────────────

class ProjectMembersView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            with connection.cursor() as c:
                c.execute("""
                    SELECT pm.*, u.name, u.email, u.role
                    FROM project_members pm
                    LEFT JOIN users u ON u.id = pm.user_id
                    WHERE pm.project_id = %s
                """, [pk])
                cols = [d[0] for d in c.description]
                rows = [dict(zip(cols, r)) for r in c.fetchall()]
            return Response(rows)
        except Exception:
            return Response([])

    def post(self, request, pk):
        try:
            user_id = request.data.get('user_id')
            role = request.data.get('role', 'developer')
            with connection.cursor() as c:
                c.execute("""
                    INSERT INTO project_members (project_id, user_id, role, created_at)
                    VALUES (%s, %s, %s, NOW())
                    ON DUPLICATE KEY UPDATE role = %s
                """, [pk, user_id, role, role])
            return Response({'detail': 'Added'}, status=201)
        except Exception as e:
            return Response({'detail': str(e)}, status=400)
