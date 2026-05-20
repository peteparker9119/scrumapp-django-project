from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from ..models import Bug, ScrumUser, BacklogItem
import datetime


def gen_bug_id(project_id):
    count = Bug.objects.filter(project_id=project_id).count() + 1
    return f"BUG-{project_id}-{count:03d}"


class BugListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        project_id = request.query_params.get('project_id')
        qs = Bug.objects.all()
        if project_id:
            qs = qs.filter(project_id=project_id)
        bugs = list(qs.order_by('-created_at').values())
        user_ids = set()
        item_ids = set()
        for b in bugs:
            if b.get('assigned_to'):     user_ids.add(b['assigned_to'])
            if b.get('reported_by'):     user_ids.add(b['reported_by'])
            if b.get('backlog_item_id'): item_ids.add(b['backlog_item_id'])
        users = {u.id: u.name for u in ScrumUser.objects.filter(id__in=user_ids)}
        items = {i.id: i.title for i in BacklogItem.objects.filter(id__in=item_ids)}
        for b in bugs:
            b['assigned_to_name']   = users.get(b.get('assigned_to'), '')
            b['reported_by_name']   = users.get(b.get('reported_by'), '')
            b['backlog_item_title'] = items.get(b.get('backlog_item_id'), '')
            for f in ['created_at', 'updated_at', 'resolved_at', 'closed_at']:
                if b.get(f): b[f] = str(b[f])
            if b.get('due_date'): b['due_date'] = str(b['due_date'])
        return Response(bugs)

    def post(self, request):
        user = request.user
        project_id = request.data.get('project_id')
        bug = Bug(
            bug_id=gen_bug_id(project_id),
            project_id=project_id,
            title=request.data.get('title'),
            description=request.data.get('description', ''),
            severity=request.data.get('severity', 'medium'),
            priority=request.data.get('priority', 'medium'),
            status='open',
            environment=request.data.get('environment', 'dev'),
            assigned_to=request.data.get('assigned_to'),
            reported_by=user.id,
            sprint_id=request.data.get('sprint_id'),
            backlog_item_id=request.data.get('backlog_item_id'),
            reproduction_steps=request.data.get('reproduction_steps', ''),
            sla_hours=request.data.get('sla_hours', 72),
            due_date=request.data.get('due_date'),
        )
        bug.save()
        return Response({'id': bug.id, 'bug_id': bug.bug_id}, status=201)


class BugDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            bug = Bug.objects.get(id=pk)
        except Bug.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        data = {f.name: getattr(bug, f.name) for f in bug._meta.fields}
        return Response(data)

    def patch(self, request, pk):
        allowed = ['title', 'description', 'severity', 'priority', 'status', 'environment',
                   'assigned_to', 'sprint_id', 'backlog_item_id', 'reproduction_steps',
                   'root_cause', 'resolution_notes', 'sla_hours', 'due_date']
        updates = {f: request.data[f] for f in allowed if f in request.data}
        if updates.get('status') == 'closed':
            updates['closed_at'] = datetime.datetime.now()
        Bug.objects.filter(id=pk).update(**updates)
        return Response({'detail': 'Updated'})

    def delete(self, request, pk):
        Bug.objects.filter(id=pk).delete()
        return Response({'detail': 'Deleted'})
