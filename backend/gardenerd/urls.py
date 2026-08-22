"""
URL configuration for gardenerd project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

from django.conf import settings
from django.contrib import admin
from django.urls import path, re_path
from django.views.decorators.csrf import csrf_exempt
from django.views.static import serve
from strawberry.django.views import GraphQLView

from apps.journal.views import upload_journal_photo

from .schema import schema

urlpatterns = [
    path('admin/', admin.site.urls),
    path('graphql/', csrf_exempt(GraphQLView.as_view(schema=schema))),
    path(
        'api/journal-events/<int:event_id>/photos/',
        upload_journal_photo,
        name='upload-journal-photo',
    ),
]

if settings.STORAGE_BACKEND == 'filesystem':
    urlpatterns.append(
        re_path(
            rf'^{settings.MEDIA_URL.lstrip("/")}(?P<path>.*)$',
            serve,
            {'document_root': settings.MEDIA_ROOT},
        )
    )
