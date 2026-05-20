from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from ..models import Sprint, SprintMember, SprintItem, BacklogItem, ScrumUser, EmployeeMaster


class SprintListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        project_id = request.query_params.get('project_id')
        qs = Sprint.objects.all()
        if project_id:
            qs = qs.filter(project_id=project_id)
        sprints = []
        for s in qs.order_by('-created_at'):
            d = {f.name: getattr(s, f.name) for f in s._meta.fields}
            d['start_date'] = str(d['start_date']) if d['start_date'] else None
            d['end_date']   = str(d['end_date'])   if d['end_date']   else None
            sprints.append(d)
        return Response(sprints)

    def post(self, request):
        user = request.user
        s = Sprint(
            project_id=request.data.get('project_id'),
            name=request.data.get('name'),
            goal=request.data.get('goal', ''),
            start_date=request.data.get('start_date'),
            end_date=request.data.get('end_date'),
            status='planning',
            created_by=user.id,
        )
        s.save()
        return Response({'id': s.id, 'name': s.name}, status=201)


class SprintDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            s = Sprint.objects.get(id=pk)
        except Sprint.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        d = {f.name: getattr(s, f.name) for f in s._meta.fields}
        d['start_date'] = str(d['start_date']) if d['start_date'] else None
        d['end_date']   = str(d['end_date'])   if d['end_date']   else None

        # Members
        members = list(SprintMember.objects.filter(sprint_id=pk).values())
        emis_ids = [m['emis_user_id'] for m in members]
        emps = {e.emis_user_id: e for e in EmployeeMaster.objects.filter(emis_user_id__in=emis_ids)}
        for m in members:
            emp = emps.get(m['emis_user_id'])
            m['name'] = emp.name if emp else str(m['emis_user_id'])
            m['designation'] = emp.designation if emp else ''
            m['scrum_team']  = emp.scrum_team  if emp else ''

        # Items
        try:
            items_qs = SprintItem.objects.filter(sprint_id=pk).values(
                'id', 'backlog_item_id', 'status', 'actual_points')
            items = list(items_qs)
        except Exception:
            items = []

        d['members'] = members
        d['items'] = items
        return Response(d)

    def patch(self, request, pk):
        allowed = ['name', 'goal', 'start_date', 'end_date', 'status']
        updates = {f: request.data[f] for f in allowed if f in request.data}
        Sprint.objects.filter(id=pk).update(**updates)
        return Response({'detail': 'Updated'})

    def delete(self, request, pk):
        Sprint.objects.filter(id=pk).delete()
        return Response({'detail': 'Deleted'})


class SprintMembersView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        members = list(SprintMember.objects.filter(sprint_id=pk).values())
        emis_ids = [m['emis_user_id'] for m in members]
        emps = {e.emis_user_id: e for e in EmployeeMaster.objects.filter(emis_user_id__in=emis_ids)}
        for m in members:
            emp = emps.get(m['emis_user_id'])
            m['name'] = emp.name if emp else str(m['emis_user_id'])
            m['designation'] = emp.designation if emp else ''
            m['scrum_team']  = emp.scrum_team  if emp else ''
        return Response(members)

    def post(self, request, pk):
        emis_user_id   = request.data.get('emis_user_id')
        working_days   = request.data.get('working_days', 10)
        daily_capacity = request.data.get('daily_capacity', 2.0)
        sm, created = SprintMember.objects.get_or_create(
            sprint_id=pk, emis_user_id=emis_user_id,
            defaults={'working_days': working_days, 'daily_capacity': daily_capacity}
        )
        if not created:
            SprintMember.objects.filter(id=sm.id).update(
                working_days=working_days, daily_capacity=daily_capacity)
        return Response({'id': sm.id}, status=201 if created else 200)

    def delete(self, request, pk):
        emis_user_id = request.data.get('emis_user_id') or request.query_params.get('emis_user_id')
        SprintMember.objects.filter(sprint_id=pk, emis_user_id=emis_user_id).delete()
        return Response({'detail': 'Removed'})
