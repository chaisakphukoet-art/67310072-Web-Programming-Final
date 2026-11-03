from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    RegisterView,
    VerifyEmailView,
    ResendVerificationCodeView,
    CustomLoginView,
    UserProfileView,
    CategoryListView,
    ProductListCreateView,
    ProductDetailView,
    OrderListCreateView,
    OrderDetailView,
    DashboardStatsView,
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='api_register'),
    path('verify-email/', VerifyEmailView.as_view(), name='api_verify_email'),
    path('resend-code/', ResendVerificationCodeView.as_view(), name='api_resend_code'),
    path('token/', CustomLoginView.as_view(), name='api_token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='api_token_refresh'),
    path('profile/', UserProfileView.as_view(), name='api_profile'),

    path('categories/', CategoryListView.as_view(), name='api_categories'),

    path('products/', ProductListCreateView.as_view(), name='api_products_list_create'),
    path('products/<int:pk>/', ProductDetailView.as_view(), name='api_product_detail'),

    path('orders/', OrderListCreateView.as_view(), name='api_orders_list_create'),
    path('orders/<int:pk>/', OrderDetailView.as_view(), name='api_order_detail'),

    path('stats/', DashboardStatsView.as_view(), name='api_dashboard_stats'),
]
