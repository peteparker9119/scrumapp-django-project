from django.urls import path
from .views.auth import (LoginView, RegisterView, MeView, ChangePasswordView,
                          RefreshView, UsersView, UserDetailView, HealthView)
from .views.projects import ProjectListView, ProjectDetailView
from .views.sprints import SprintListView, SprintDetailView, SprintMembersView
from .views.backlog import BacklogListView, BacklogDetailView
from .views.bugs import BugListView, BugDetailView
from .views.retro import RetroView, RetroItemsView, RetroVoteView, RetroPublishView
from .views.reports import VelocityView, SprintStatsView, BugTrendView, TeamStatsView
from .views.dashboard import DashboardStatsView
from .views.extras import (
    SprintItemsView, SprintItemsBulkView, SprintItemDetailView, SprintItemStatusView,
    SprintBurndownView, SprintCapacityView,
    BugStatsView, BugCommentsView,
    EmployeeMasterListView, EmployeeMasterDetailView,
    EmployeeListView, EmployeeDetailView,
    RequirementListView, RequirementDetailView,
    GroomingListView, GroomingDetailView, GroomingStatsView, GroomingReadyView,
    ReleaseListView, ReleaseDetailView, ReleaseStatsView,
    AdminLogsView, AdminWorkspaceView, AdminScrumStatsView,
    ProjectMembersView,
)

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
    path('projects/<int:pk>/members/', ProjectMembersView.as_view()),
    # Sprints
    path('sprints/',              SprintListView.as_view()),
    path('sprints/<int:pk>/',     SprintDetailView.as_view()),
    path('sprints/<int:pk>/members/',               SprintMembersView.as_view()),
    path('sprints/<int:pk>/items/',                 SprintItemsView.as_view()),
    path('sprints/<int:pk>/items/bulk/',            SprintItemsBulkView.as_view()),
    path('sprints/<int:pk>/items/<int:item_id>/',           SprintItemDetailView.as_view()),
    path('sprints/<int:pk>/items/<int:item_id>/status/',    SprintItemStatusView.as_view()),
    path('sprints/<int:pk>/burndown/',  SprintBurndownView.as_view()),
    path('sprints/<int:pk>/capacity/',  SprintCapacityView.as_view()),
    # Backlog
    path('backlog/',              BacklogListView.as_view()),
    path('backlog/<int:pk>/',     BacklogDetailView.as_view()),
    # Bugs
    path('bugs/stats/',           BugStatsView.as_view()),
    path('bugs/',                 BugListView.as_view()),
    path('bugs/<int:pk>/',        BugDetailView.as_view()),
    path('bugs/<int:pk>/comments/', BugCommentsView.as_view()),
    # Retro
    path('retrospectives/',                                         RetroView.as_view()),
    path('retrospectives/<int:retro_id>/items/',                    RetroItemsView.as_view()),
    path('retrospectives/<int:retro_id>/items/<int:item_id>/',      RetroItemsView.as_view()),
    path('retrospectives/<int:retro_id>/items/<int:item_id>/vote/', RetroVoteView.as_view()),
    path('retrospectives/<int:retro_id>/publish/',                  RetroPublishView.as_view()),
    # Dashboard
    path('dashboard/stats/', DashboardStatsView.as_view()),
    # Reports
    path('reports/velocity/', VelocityView.as_view()),
    path('reports/sprints/',  SprintStatsView.as_view()),
    path('reports/bugs/',     BugTrendView.as_view()),
    path('reports/team/',     TeamStatsView.as_view()),
    # Employees master
    path('employees-master/',         EmployeeMasterListView.as_view()),
    path('employees-master/<int:pk>/', EmployeeMasterDetailView.as_view()),
    # Employees (scrum users)
    path('employees/',         EmployeeListView.as_view()),
    path('employees/<int:pk>/', EmployeeDetailView.as_view()),
    # Requirements
    path('requirements/',         RequirementListView.as_view()),
    path('requirements/<int:pk>/', RequirementDetailView.as_view()),
    # Grooming
    path('grooming/',                    GroomingListView.as_view()),
    path('grooming/stats/',              GroomingStatsView.as_view()),
    path('grooming/ready-for-sprint/',   GroomingReadyView.as_view()),
    path('grooming/<int:pk>/',           GroomingDetailView.as_view()),
    # Releases
    path('releases/',          ReleaseListView.as_view()),
    path('releases/stats/',    ReleaseStatsView.as_view()),
    path('releases/<int:pk>/', ReleaseDetailView.as_view()),
    # Admin
    path('admin/logs/',        AdminLogsView.as_view()),
    path('admin/workspace/',   AdminWorkspaceView.as_view()),
    path('admin/workspace/<str:key>/', AdminWorkspaceView.as_view()),
    path('admin/scrum-stats/', AdminScrumStatsView.as_view()),
]
