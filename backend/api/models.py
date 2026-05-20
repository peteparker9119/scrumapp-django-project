from django.db import models


class ScrumUser(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=100)
    email = models.CharField(max_length=150, unique=True)
    password = models.CharField(max_length=255)
    role = models.CharField(max_length=50, default='developer')
    status = models.CharField(max_length=20, default='active')
    avatar = models.CharField(max_length=10, null=True, blank=True)
    extra_roles = models.CharField(max_length=255, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=False, null=True)
    updated_at = models.DateTimeField(auto_now=False, null=True)

    class Meta:
        managed = False
        db_table = 'users'


class EmployeeMaster(models.Model):
    id = models.AutoField(primary_key=True)
    emis_user_id = models.IntegerField(unique=True)
    name = models.CharField(max_length=100)
    is_lead = models.BooleanField(default=False)
    scrum_team = models.CharField(max_length=50, null=True, blank=True)
    cohort = models.IntegerField(null=True, blank=True)
    designation = models.CharField(max_length=150, null=True, blank=True)
    phone = models.CharField(max_length=20, null=True, blank=True)
    email = models.CharField(max_length=150, null=True, blank=True)
    role = models.CharField(max_length=100, null=True, blank=True)
    perform_iq_role = models.CharField(max_length=20, default='EMPLOYEE')
    is_manager = models.BooleanField(default=False)
    is_master_admin = models.BooleanField(default=False)
    reports_to_emis_id = models.IntegerField(null=True, blank=True)
    level = models.CharField(max_length=10, null=True, blank=True)
    status = models.CharField(max_length=20, default='active')
    created_at = models.DateTimeField(null=True)
    updated_at = models.DateTimeField(null=True)

    class Meta:
        managed = False
        db_table = 'employees_master'


class Project(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=150)
    description = models.TextField(null=True, blank=True)
    key_code = models.CharField(max_length=10, unique=True)
    status = models.CharField(max_length=20, default='active')
    created_by = models.IntegerField()
    created_at = models.DateTimeField(null=True)
    updated_at = models.DateTimeField(null=True)

    class Meta:
        managed = False
        db_table = 'projects'


class Sprint(models.Model):
    id = models.AutoField(primary_key=True)
    project_id = models.IntegerField()
    name = models.CharField(max_length=150)
    goal = models.TextField(null=True, blank=True)
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(max_length=20, default='planning')
    created_by = models.IntegerField()
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(null=True)
    updated_at = models.DateTimeField(null=True)

    class Meta:
        managed = False
        db_table = 'sprints'


class SprintMember(models.Model):
    id = models.AutoField(primary_key=True)
    sprint_id = models.IntegerField()
    emis_user_id = models.IntegerField()
    working_days = models.IntegerField(default=10)
    daily_capacity = models.DecimalField(max_digits=3, decimal_places=1, default=2.0)

    class Meta:
        managed = False
        db_table = 'sprint_members'


class SprintItem(models.Model):
    id = models.AutoField(primary_key=True)
    sprint_id = models.IntegerField()
    backlog_item_id = models.IntegerField()
    status = models.CharField(max_length=20, default='todo')
    actual_points = models.IntegerField(null=True, blank=True)

    class Meta:
        managed = False
        db_table = 'sprint_items'


class BacklogItem(models.Model):
    id = models.AutoField(primary_key=True)
    project_id = models.IntegerField()
    requirement_id = models.IntegerField(null=True, blank=True)
    title = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    acceptance_criteria = models.TextField(null=True, blank=True)
    story_points = models.IntegerField(null=True, blank=True)
    priority = models.CharField(max_length=20, default='medium')
    status = models.CharField(max_length=20, default='backlog')
    item_type = models.CharField(max_length=20, default='story')
    assigned_to = models.IntegerField(null=True, blank=True)
    created_by = models.IntegerField()
    position = models.IntegerField(default=0)
    created_at = models.DateTimeField(null=True)
    updated_at = models.DateTimeField(null=True)

    class Meta:
        managed = False
        db_table = 'backlog_items'


class Bug(models.Model):
    id = models.AutoField(primary_key=True)
    bug_id = models.CharField(max_length=20, unique=True)
    project_id = models.IntegerField()
    title = models.CharField(max_length=500)
    description = models.TextField(null=True, blank=True)
    severity = models.CharField(max_length=20, default='medium')
    priority = models.CharField(max_length=20, default='medium')
    status = models.CharField(max_length=20, default='open')
    environment = models.CharField(max_length=20, default='dev')
    assigned_to = models.IntegerField(null=True, blank=True)
    reported_by = models.IntegerField()
    requirement_id = models.IntegerField(null=True, blank=True)
    sprint_id = models.IntegerField(null=True, blank=True)
    backlog_item_id = models.IntegerField(null=True, blank=True)
    reproduction_steps = models.TextField(null=True, blank=True)
    root_cause = models.TextField(null=True, blank=True)
    resolution_notes = models.TextField(null=True, blank=True)
    sla_hours = models.IntegerField(default=72)
    due_date = models.DateField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(null=True)
    updated_at = models.DateTimeField(null=True)

    class Meta:
        managed = False
        db_table = 'bugs'


class Retrospective(models.Model):
    id = models.AutoField(primary_key=True)
    sprint_id = models.IntegerField(unique=True)
    project_id = models.IntegerField()
    status = models.CharField(max_length=20, default='draft')
    created_by = models.IntegerField()
    created_at = models.DateTimeField(null=True)
    updated_at = models.DateTimeField(null=True)

    class Meta:
        managed = False
        db_table = 'retrospectives'


class RetroItem(models.Model):
    id = models.AutoField(primary_key=True)
    retro_id = models.IntegerField()
    category = models.CharField(max_length=20)
    content = models.TextField()
    votes = models.IntegerField(default=0)
    assigned_to = models.IntegerField(null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, default='open')
    created_by = models.IntegerField()
    created_at = models.DateTimeField(null=True)

    class Meta:
        managed = False
        db_table = 'retro_items'


class RetroVote(models.Model):
    id = models.AutoField(primary_key=True)
    retro_item_id = models.IntegerField()
    user_id = models.IntegerField()
    created_at = models.DateTimeField(null=True)

    class Meta:
        managed = False
        db_table = 'retro_votes'
