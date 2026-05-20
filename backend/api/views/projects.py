from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from ..models import Project, ScrumUser
from django.utils import timezone
import datetime


class ProjectListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        projects = list(Project.objects.filter(status='active').values())
        # Enrich with creator name
        user_ids = list({p['created_by'] for p in projects})
        users = {u.id: u.name for u in ScrumUser.objects.filter(id__in=user_ids)}
        for p in projects:
            p['created_by_name'] = users.get(p['created_by'], '')
            if p.get('created_at'): p['created_at'] = str(p['created_at'])
            if p.get('updated_at'): p['updated_at'] = str(p['updated_at'])
        return Response(projects)

    def post(self, request):
        user = request.user
        p = Project(
            name=request.data.get('name'),
            description=request.data.get('description', ''),
            key_code=request.data.get('key_code', '').upper(),
            status='active',
            created_by=user.id,
        )
        p.save()
        return Response({'id': p.id, 'name': p.name, 'key_code': p.key_code}, status=201)


class ProjectDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        try:
            return Project.objects.get(id=pk)
        except Project.DoesNotExist:
            return None

    def get(self, request, pk):
        p = self.get_object(pk)
        if not p:
            return Response({'detail': 'Not found'}, status=404)
        data = {f.name: getattr(p, f.name) for f in p._meta.fields}
        return Response(data)

    def patch(self, request, pk):
        p = self.get_object(pk)
        if not p:
            return Response({'detail': 'Not found'}, status=404)
        for field in ['name', 'description', 'status']:
            if field in request.data:
                setattr(p, field, request.data[field])
        Project.objects.filter(id=pk).update(**{
            f: request.data[f] for f in ['name', 'description', 'status'] if f in request.data
        })
        return Response({'detail': 'Updated'})

    def delete(self, request, pk):
        Project.objects.filter(id=pk).update(status='archived')
        return Response({'detail': 'Archived'})
