from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from ..models import BacklogItem, ScrumUser


class BacklogListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        project_id = request.query_params.get('project_id')
        qs = BacklogItem.objects.all()
        if project_id:
            qs = qs.filter(project_id=project_id)
        items = []
        user_ids = set()
        raw = list(qs.order_by('position', '-created_at').values())
        for item in raw:
            if item.get('assigned_to'): user_ids.add(item['assigned_to'])
            if item.get('created_by'):  user_ids.add(item['created_by'])
        users = {u.id: u.name for u in ScrumUser.objects.filter(id__in=user_ids)}
        for item in raw:
            item['assigned_to_name'] = users.get(item.get('assigned_to'), '')
            item['created_by_name']  = users.get(item.get('created_by'),  '')
            if item.get('created_at'): item['created_at'] = str(item['created_at'])
            if item.get('updated_at'): item['updated_at'] = str(item['updated_at'])
            items.append(item)
        return Response(items)

    def post(self, request):
        user = request.user
        item = BacklogItem(
            project_id=request.data.get('project_id'),
            title=request.data.get('title'),
            description=request.data.get('description', ''),
            acceptance_criteria=request.data.get('acceptance_criteria', ''),
            story_points=request.data.get('story_points'),
            priority=request.data.get('priority', 'medium'),
            status=request.data.get('status', 'backlog'),
            item_type=request.data.get('item_type', 'story'),
            assigned_to=request.data.get('assigned_to'),
            created_by=user.id,
            position=request.data.get('position', 0),
        )
        item.save()
        return Response({'id': item.id, 'title': item.title}, status=201)


class BacklogDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            item = BacklogItem.objects.get(id=pk)
        except BacklogItem.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        data = {f.name: getattr(item, f.name) for f in item._meta.fields}
        return Response(data)

    def patch(self, request, pk):
        allowed = ['title', 'description', 'acceptance_criteria', 'story_points',
                   'priority', 'status', 'item_type', 'assigned_to', 'position']
        updates = {f: request.data[f] for f in allowed if f in request.data}
        BacklogItem.objects.filter(id=pk).update(**updates)
        return Response({'detail': 'Updated'})

    def delete(self, request, pk):
        BacklogItem.objects.filter(id=pk).delete()
        return Response({'detail': 'Deleted'})
