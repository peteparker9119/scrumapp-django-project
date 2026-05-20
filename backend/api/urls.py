from django.urls import path
from .views.auth import (LoginView, RegisterView, MeView, ChangePasswordView,
                          RefreshView, UsersView, UserDetailView, HealthView)
from .views.projects import ProjectListView, ProjectDetailView
from .views.sprints import SprintListView, SprintDetailView, SprintMembersView
from .views.backlog import BacklogListView, BacklogDetailView
from .views.bugs import BugListView, BugDetailView
from .views.retro import RetroView, RetroItemsView, RetroVoteView, RetroPublishView
from .views.reports import VelocityView, SprintStatsView, BugTrendView, TeamStatsView

urlpatterns = [
    # Auth
    path('auth/login/',           LoginView.as_view()),
    path('auth/register/',        RegisterView.as_view()),
    path('auth/me/',              MeView.as_view()),
    path('auth/change-password/', ChangePasswordView.as_view()),
    path('auth/refresh/',         RefreshView.as_view()),
    path('health/',               HealthView.as_view()),
    # Users
    path('users/',                UsersView.as_view()),
    path('users/<int:pk>/',       UserDetailView.as_view()),
    # Projects
    path('projects/',             ProjectListView.as_view()),
    path('projects/<int:pk>/',    ProjectDetailView.as_view()),
    # Sprints
    path('sprints/',              SprintListView.as_view()),
    path('sprints/<int:pk>/',     SprintDetailView.as_view()),
    path('sprints/<int:pk>/members/', SprintMembersView.as_view()),
    # Backlog
    path('backlog/',              BacklogListView.as_view()),
    path('backlog/<int:pk>/',     BacklogDetailView.as_view()),
    # Bugs
    path('bugs/',                 BugListView.as_view()),
    path('bugs/<int:pk>/',        BugDetailView.as_view()),
    # Retro
    path('retrospectives/',                                         RetroView.as_view()),
    path('retrospectives/<int:retro_id>/items/',                    RetroItemsView.as_view()),
    path('retrospectives/<int:retro_id>/items/<int:item_id>/',      RetroItemsView.as_view()),
    path('retrospectives/<int:retro_id>/items/<int:item_id>/vote/', RetroVoteView.as_view()),
    path('retrospectives/<int:retro_id>/publish/',                  RetroPublishView.as_view()),
    # Reports
    path('reports/velocity/', VelocityView.as_view()),
    path('reports/sprints/',  SprintStatsView.as_view()),
    path('reports/bugs/',     BugTrendView.as_view()),
    path('reports/team/',     TeamStatsView.as_view()),
]
