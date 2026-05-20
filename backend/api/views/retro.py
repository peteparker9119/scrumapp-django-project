from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from ..models import Retrospective, RetroItem, RetroVote


class RetroView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        project_id = request.query_params.get('project_id')
        qs = Retrospective.objects.all()
        if project_id:
            qs = qs.filter(project_id=project_id)
        return Response(list(qs.values()))

    def post(self, request):
        user = request.user
        sprint_id  = request.data.get('sprint_id')
        project_id = request.data.get('project_id')
        retro, created = Retrospective.objects.get_or_create(
            sprint_id=sprint_id,
            defaults={'project_id': project_id, 'status': 'draft', 'created_by': user.id}
        )
        data = {f.name: getattr(retro, f.name) for f in retro._meta.fields}
        items = list(RetroItem.objects.filter(retro_id=retro.id).values())
        voted_ids = set(RetroVote.objects.filter(
            retro_item_id__in=[i['id'] for i in items], user_id=user.id
        ).values_list('retro_item_id', flat=True))
        for item in items:
            item['user_voted'] = item['id'] in voted_ids
            if item.get('due_date'):   item['due_date']   = str(item['due_date'])
            if item.get('created_at'): item['created_at'] = str(item['created_at'])
        data['items'] = items
        return Response(data, status=201 if created else 200)


class RetroItemsView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, retro_id):
        user = request.user
        item = RetroItem(
            retro_id=retro_id,
            category=request.data.get('category'),
            content=request.data.get('content'),
            assigned_to=request.data.get('assigned_to'),
            due_date=request.data.get('due_date'),
            status='open',
            created_by=user.id,
        )
        item.save()
        return Response({'id': item.id, 'content': item.content}, status=201)

    def patch(self, request, retro_id, item_id):
        allowed = ['content', 'category', 'assigned_to', 'due_date', 'status']
        updates = {f: request.data[f] for f in allowed if f in request.data}
        RetroItem.objects.filter(id=item_id, retro_id=retro_id).update(**updates)
        return Response({'detail': 'Updated'})

    def delete(self, request, retro_id, item_id):
        RetroItem.objects.filter(id=item_id, retro_id=retro_id).delete()
        return Response({'detail': 'Deleted'})


class RetroVoteView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, retro_id, item_id):
        user = request.user
        vote, created = RetroVote.objects.get_or_create(retro_item_id=item_id, user_id=user.id)
        if created:
            RetroItem.objects.filter(id=item_id).update(votes=RetroItem.objects.get(id=item_id).votes + 1)
            return Response({'voted': True})
        else:
            vote.delete()
            item = RetroItem.objects.get(id=item_id)
            RetroItem.objects.filter(id=item_id).update(votes=max(0, item.votes - 1))
            return Response({'voted': False})


class RetroPublishView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, retro_id):
        Retrospective.objects.filter(id=retro_id).update(status='published')
        return Response({'detail': 'Published'})
