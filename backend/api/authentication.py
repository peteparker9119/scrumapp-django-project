import bcrypt
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from .models import ScrumUser, EmployeeMaster


def role_from_designation(designation):
    d = (designation or '').lower()
    if 'scrum master' in d:    return 'scrum_master'
    if 'product manager' in d: return 'product_manager'
    if 'project manager' in d or 'architect' in d: return 'scrum_master'
    return None


def derive_role(emp):
    if not emp: return 'developer'
    if emp.is_master_admin or emp.level == 'L0': return 'admin'
    if emp.is_manager and emp.level == 'L1':     return 'product_manager'
    if emp.is_manager and emp.level == 'L2':     return 'scrum_master'
    if emp.is_lead:                               return 'scrum_master'
    return role_from_designation(emp.designation) or 'developer'


def derive_extra_roles(emp, primary_role):
    if not emp: return None
    extras = []
    d = (emp.designation or '').lower()
    if 'scrum master' in d and primary_role != 'scrum_master':
        extras.append('scrum_master')
    if 'product manager' in d and primary_role != 'product_manager':
        extras.append('product_manager')
    if extras:
        return ','.join(extras)
    return None


def get_tokens_for_user(user):
    """Generate JWT tokens for a ScrumUser instance."""
    refresh = RefreshToken()
    refresh['user_id'] = user.id
    refresh['email'] = user.email
    refresh['role'] = user.role
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }


def verify_password(plain, hashed):
    try:
        return bcrypt.checkpw(plain.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False


def hash_password(plain):
    return bcrypt.hashpw(plain.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def build_user_profile(user, emp=None):
    extra_roles_list = [r.strip() for r in (user.extra_roles or '').split(',') if r.strip()]
    roles = [user.role] + [r for r in extra_roles_list if r != user.role]
    return {
        'id': user.id,
        'name': user.name,
        'email': user.email,
        'role': user.role,
        'roles': roles,
        'extra_roles': user.extra_roles,
        'status': user.status,
        'avatar': user.avatar,
        'designation': emp.designation if emp else None,
        'level': emp.level if emp else None,
        'scrum_team': emp.scrum_team if emp else None,
        'is_lead': emp.is_lead if emp else False,
        'is_manager': emp.is_manager if emp else False,
        'emis_user_id': emp.emis_user_id if emp else None,
    }


class ScrumJWTAuthentication(JWTAuthentication):
    """Override get_user to load ScrumUser instead of Django auth.User."""

    def get_user(self, validated_token):
        try:
            user_id = validated_token['user_id']
        except KeyError:
            raise InvalidToken('Token contained no recognizable user identification')
        try:
            user = ScrumUser.objects.get(id=user_id)
        except ScrumUser.DoesNotExist:
            raise AuthenticationFailed('User not found')
        if user.status != 'active':
            raise AuthenticationFailed('User is inactive')
        return user
