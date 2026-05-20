from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from django.db import connection
from ..models import ScrumUser, EmployeeMaster
from ..authentication import (
    verify_password, hash_password, get_tokens_for_user,
    build_user_profile, derive_role, derive_extra_roles
)


def get_emp(email):
    try:
        return EmployeeMaster.objects.get(email=email)
    except EmployeeMaster.DoesNotExist:
        return None


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email', '').strip().lower()
        password = request.data.get('password', '')
        if not email or not password:
            return Response({'detail': 'Email and password required'}, status=400)
        try:
            user = ScrumUser.objects.get(email__iexact=email)
        except ScrumUser.DoesNotExist:
            return Response({'detail': 'Invalid credentials'}, status=401)
        if not verify_password(password, user.password):
            return Response({'detail': 'Invalid credentials'}, status=401)
        if user.status != 'active':
            return Response({'detail': 'Account is inactive'}, status=401)

        # Sync role from EMIS
        emp = get_emp(email)
        if emp:
            derived = derive_role(emp)
            extra = derive_extra_roles(emp, derived)
            if user.role != derived or user.extra_roles != extra or user.name != emp.name:
                ScrumUser.objects.filter(id=user.id).update(
                    role=derived, extra_roles=extra, name=emp.name)
                user.role = derived
                user.extra_roles = extra
                user.name = emp.name

        tokens = get_tokens_for_user(user)
        return Response({**tokens, 'user': build_user_profile(user, emp)})


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        name  = request.data.get('name', '').strip()
        email = request.data.get('email', '').strip().lower()
        password = request.data.get('password', '')
        if not name or not email or not password:
            return Response({'detail': 'name, email, password required'}, status=400)
        if ScrumUser.objects.filter(email__iexact=email).exists():
            return Response({'detail': 'Email already registered'}, status=400)
        emp = get_emp(email)
        role = derive_role(emp) if emp else 'developer'
        extra = derive_extra_roles(emp, role) if emp else None
        display_name = emp.name if emp else name
        user = ScrumUser(
            name=display_name, email=email,
            password=hash_password(password),
            role=role, extra_roles=extra, status='active',
        )
        user.save()
        emp = get_emp(email)
        tokens = get_tokens_for_user(user)
        return Response({**tokens, 'user': build_user_profile(user, emp)}, status=201)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user  # ScrumUser via ScrumJWTAuthentication
        emp = get_emp(user.email)
        return Response(build_user_profile(user, emp))

    def patch(self, request):
        user = request.user
        allowed = ['name', 'avatar']
        for field in allowed:
            if field in request.data:
                setattr(user, field, request.data[field])
        ScrumUser.objects.filter(id=user.id).update(
            **{f: getattr(user, f) for f in allowed if f in request.data}
        )
        emp = get_emp(user.email)
        return Response(build_user_profile(user, emp))


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        old_pw = request.data.get('old_password', '')
        new_pw = request.data.get('new_password', '')
        if not verify_password(old_pw, user.password):
            return Response({'detail': 'Current password is incorrect'}, status=400)
        if len(new_pw) < 6:
            return Response({'detail': 'New password too short'}, status=400)
        ScrumUser.objects.filter(id=user.id).update(password=hash_password(new_pw))
        return Response({'detail': 'Password changed'})


class RefreshView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        refresh_token = request.data.get('refresh')
        try:
            token = RefreshToken(refresh_token)
            return Response({'access': str(token.access_token)})
        except TokenError as e:
            return Response({'detail': str(e)}, status=401)


class UsersView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        users = ScrumUser.objects.filter(status='active').values(
            'id', 'name', 'email', 'role', 'extra_roles', 'status', 'avatar')
        return Response(list(users))


class UserDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            user = ScrumUser.objects.get(id=pk)
        except ScrumUser.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        emp = get_emp(user.email)
        return Response(build_user_profile(user, emp))

    def patch(self, request, pk):
        try:
            user = ScrumUser.objects.get(id=pk)
        except ScrumUser.DoesNotExist:
            return Response({'detail': 'Not found'}, status=404)
        allowed = ['name', 'role', 'status', 'avatar']
        updates = {f: request.data[f] for f in allowed if f in request.data}
        if updates:
            ScrumUser.objects.filter(id=pk).update(**updates)
        return Response({'detail': 'Updated'})

    def delete(self, request, pk):
        ScrumUser.objects.filter(id=pk).delete()
        return Response({'detail': 'Deleted'})


class HealthView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        import django
        return Response({'status': 'ok', 'version': '1.0.0', 'django_version': django.__version__})
