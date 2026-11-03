import os
import uuid
import datetime
import random
from decimal import Decimal
from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.db.models import Sum, Count, Q
from django.shortcuts import render, get_object_or_404
from rest_framework import generics, status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework import serializers

from .models import User, Category, Product, Order, OrderItem
from .serializers import (
    RegisterSerializer,
    UserProfileSerializer,
    CategorySerializer,
    ProductSerializer,
    OrderSerializer,
    OrderCreateSerializer
)
from .permissions import IsAdminUserRole, IsMemberRole, IsAdminOrReadOnly


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        user = self.user

        if not user.is_email_verified and not user.is_staff and not user.is_superuser:
            raise serializers.ValidationError({
                "error": "Please verify your email address before logging in.",
                "is_unverified": True,
                "email": user.email
            })

        data['user'] = {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'role': user.role,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'is_email_verified': user.is_email_verified
        }
        return data


class CustomLoginView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        user = serializer.save()

        email_sent = False
        try:
            subject = "TechNova IT Store - Your OTP Verification Code"
            message = (
                f"Hello {user.username},\n\n"
                f"Thank you for registering at TechNova IT Store.\n\n"
                f"Your 6-Digit OTP Verification Code is: {user.verification_code}\n\n"
                f"Alternatively, click the link below to verify your account:\n"
                f"{request.build_absolute_uri('/verify-email/')}?code={user.verification_code}&email={user.email}\n\n"
                f"Best regards,\nTechNova IT Solutions Team"
            )
            send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email], fail_silently=False)
            email_sent = True
        except Exception:
            pass

        return Response({
            "message": "Registration successful. Please check your email for the OTP verification code.",
            "email": user.email,
            "username": user.username,
            "role": user.role,
            "email_sent": email_sent
        }, status=status.HTTP_201_CREATED)


class VerifyEmailView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get('email', '').strip().lower()
        code = request.data.get('code', '').strip()
        token = request.data.get('token', '').strip()

        if not email and not token:
            return Response({"error": "Email and 6-digit OTP code are required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            if email:
                user = User.objects.get(email__iexact=email)
            else:
                user = User.objects.get(verification_token=token)

            if user.is_email_verified:
                refresh = RefreshToken.for_user(user)
                return Response({
                    "message": "Email is already verified.",
                    "already_verified": True,
                    "access": str(refresh.access_token),
                    "refresh": str(refresh),
                    "user": UserProfileSerializer(user).data
                }, status=status.HTTP_200_OK)

            if code and user.verification_code != code:
                return Response({"error": "Invalid verification code."}, status=status.HTTP_400_BAD_REQUEST)

            if token and user.verification_token != token:
                return Response({"error": "Invalid or expired verification token."}, status=status.HTTP_400_BAD_REQUEST)

            user.is_email_verified = True
            user.save()

            refresh = RefreshToken.for_user(user)
            return Response({
                "message": "Email verified successfully.",
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": UserProfileSerializer(user).data
            }, status=status.HTTP_200_OK)

        except User.DoesNotExist:
            return Response({"error": "User account not found."}, status=status.HTTP_404_NOT_FOUND)


class ResendVerificationCodeView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = request.data.get('email', '').strip().lower()
        if not email:
            return Response({"error": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(email__iexact=email)
            if user.is_email_verified:
                return Response({"message": "Account is already verified."}, status=status.HTTP_200_OK)

            user.verification_code = f"{random.randint(100000, 999999)}"
            user.save()

            try:
                subject = "TechNova IT Store - New OTP Verification Code"
                message = (
                    f"Hello {user.username},\n\n"
                    f"Your new OTP Verification Code is: {user.verification_code}\n\n"
                    f"Alternatively, click the link below to verify your account:\n"
                    f"{request.build_absolute_uri('/verify-email/')}?code={user.verification_code}&email={user.email}\n\n"
                    f"Best regards,\nTechNova IT Solutions Team"
                )
                send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [user.email], fail_silently=False)
            except Exception:
                pass

            return Response({
                "message": f"A new OTP code has been sent to {email}.",
                "email": user.email
            }, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            return Response({"error": "User account not found."}, status=status.HTTP_404_NOT_FOUND)


class UserProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = UserProfileSerializer(request.user)
        return Response(serializer.data)

    def put(self, request):
        user = request.user
        user.first_name = request.data.get('first_name', user.first_name)
        user.last_name = request.data.get('last_name', user.last_name)
        user.phone = request.data.get('phone', user.phone)
        user.save()
        return Response(UserProfileSerializer(user).data)


class CategoryListView(generics.ListCreateAPIView):
    queryset = Category.objects.all().order_by('name')
    serializer_class = CategorySerializer
    permission_classes = [IsAdminOrReadOnly]


class ProductListCreateView(generics.ListCreateAPIView):
    serializer_class = ProductSerializer
    permission_classes = [IsAdminOrReadOnly]

    def get_queryset(self):
        queryset = Product.objects.select_related('category').all().order_by('-created_at')

        search = self.request.query_params.get('search', '').strip()
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) |
                Q(description__icontains=search) |
                Q(brand__icontains=search) |
                Q(category__name__icontains=search)
            )

        category_id = self.request.query_params.get('category')
        if category_id:
            queryset = queryset.filter(category_id=category_id)

        ordering = self.request.query_params.get('ordering', '')
        if ordering == 'price_asc':
            queryset = queryset.order_by('price')
        elif ordering == 'price_desc':
            queryset = queryset.order_by('-price')
        elif ordering == 'name_asc':
            queryset = queryset.order_by('name')
        elif ordering == 'newest':
            queryset = queryset.order_by('-created_at')

        featured = self.request.query_params.get('featured')
        if featured == 'true':
            queryset = queryset.filter(is_featured=True)

        return queryset


class ProductDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Product.objects.select_related('category').all()
    serializer_class = ProductSerializer
    permission_classes = [IsAdminOrReadOnly]


class OrderListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if getattr(user, 'role', '') == 'admin' or user.is_staff or user.is_superuser:
            orders = Order.objects.prefetch_related('items').all().order_by('-created_at')
        else:
            orders = Order.objects.prefetch_related('items').filter(user=user).order_by('-created_at')

        serializer = OrderSerializer(orders, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = OrderCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        items_data = data['items']

        with transaction.atomic():
            total_amount = Decimal('0.00')
            order_items_to_create = []

            for item in items_data:
                product_id = item['product_id']
                qty = item['quantity']

                try:
                    product = Product.objects.select_for_update().get(id=product_id)
                except Product.DoesNotExist:
                    return Response({"error": f"Product with ID {product_id} not found."}, status=status.HTTP_400_BAD_REQUEST)

                if product.stock < qty:
                    return Response({
                        "error": f"Product '{product.name}' has insufficient stock (Only {product.stock} left)."
                    }, status=status.HTTP_400_BAD_REQUEST)

                subtotal = product.price * qty
                total_amount += subtotal

                product.stock -= qty
                product.save()

                order_items_to_create.append({
                    'product': product,
                    'product_name': product.name,
                    'price': product.price,
                    'quantity': qty,
                    'subtotal': subtotal
                })

            order_number = f"TN-{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}-{random.randint(100, 999)}"
            order = Order.objects.create(
                order_number=order_number,
                user=request.user,
                total_amount=total_amount,
                status='pending',
                shipping_name=data['shipping_name'],
                shipping_address=data['shipping_address'],
                shipping_phone=data['shipping_phone'],
                payment_method=data.get('payment_method', 'PromptPay / QR Code')
            )

            for item in order_items_to_create:
                OrderItem.objects.create(
                    order=order,
                    product=item['product'],
                    product_name=item['product_name'],
                    price=item['price'],
                    quantity=item['quantity'],
                    subtotal=item['subtotal']
                )

        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)


class OrderDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        user = request.user
        if getattr(user, 'role', '') == 'admin' or user.is_staff or user.is_superuser:
            order = get_object_or_404(Order.objects.prefetch_related('items'), pk=pk)
        else:
            order = get_object_or_404(Order.objects.prefetch_related('items'), pk=pk, user=user)

        return Response(OrderSerializer(order).data)

    def patch(self, request, pk):
        user = request.user
        if not (getattr(user, 'role', '') == 'admin' or user.is_staff or user.is_superuser):
            return Response({"error": "Admin privileges required to update order status."}, status=status.HTTP_403_FORBIDDEN)

        order = get_object_or_404(Order, pk=pk)
        new_status = request.data.get('status')
        if new_status in dict(Order.STATUS_CHOICES):
            order.status = new_status
            order.save()
            return Response(OrderSerializer(order).data)
        return Response({"error": "Invalid order status."}, status=status.HTTP_400_BAD_REQUEST)


class DashboardStatsView(APIView):
    permission_classes = [IsAdminUserRole]

    def get(self, request):
        total_products = Product.objects.count()
        total_stock = Product.objects.aggregate(total=Sum('stock'))['total'] or 0
        total_orders = Order.objects.count()
        total_revenue = Order.objects.filter(~Q(status='cancelled')).aggregate(total=Sum('total_amount'))['total'] or Decimal('0.00')

        recent_orders = Order.objects.select_related('user').order_by('-created_at')[:5]
        low_stock_products = Product.objects.filter(stock__lte=5).order_by('stock')[:5]

        return Response({
            "total_products": total_products,
            "total_stock": total_stock,
            "total_orders": total_orders,
            "total_revenue": total_revenue,
            "recent_orders": OrderSerializer(recent_orders, many=True).data,
            "low_stock_products": ProductSerializer(low_stock_products, many=True).data
        })


def index_view(request):
    return render(request, 'index.html', {
        'company_name': 'TechNova IT Solutions & Store',
        'student_id': '67310072',
        'course_name': '29038764 Web Programming with Framework Technology'
    })


def email_verify_page(request):
    code = request.GET.get('code', '').strip()
    email = request.GET.get('email', '').strip()
    verified = False
    message = ""

    if email and code:
        try:
            user = User.objects.get(email__iexact=email)
            if user.is_email_verified or user.verification_code == code:
                user.is_email_verified = True
                user.save()
                verified = True
                message = f"Email {user.email} has been successfully verified."
            else:
                message = "Invalid verification code."
        except User.DoesNotExist:
            message = "User account not found."
    else:
        message = "Incomplete verification parameters."

    return render(request, 'email_verify.html', {
        'verified': verified,
        'message': message,
        'email': email,
        'code': code
    })
