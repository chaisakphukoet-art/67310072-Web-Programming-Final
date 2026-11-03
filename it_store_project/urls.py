from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from store.views import index_view, email_verify_page

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('store.urls')),
    path('verify-email/', email_verify_page, name='email_verify_page'),
    path('', index_view, name='index'),
]

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
