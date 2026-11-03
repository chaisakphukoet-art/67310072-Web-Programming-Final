from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, Category, Product, Order, OrderItem

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ('username', 'email', 'role', 'is_email_verified', 'is_staff', 'date_joined')
    list_filter = ('role', 'is_email_verified', 'is_staff')
    fieldsets = UserAdmin.fieldsets + (
        ('Additional Info (TechNova IT Store)', {
            'fields': ('role', 'phone', 'is_email_verified', 'verification_code', 'verification_token')
        }),
    )

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'icon')
    prepopulated_fields = {'slug': ('name',)}

@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'brand', 'price', 'stock', 'is_featured', 'created_at')
    list_filter = ('category', 'brand', 'is_featured')
    search_fields = ('name', 'description', 'brand')
    list_editable = ('price', 'stock', 'is_featured')

class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ('product_name', 'price', 'quantity', 'subtotal')

@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('order_number', 'user', 'total_amount', 'status', 'payment_method', 'created_at')
    list_filter = ('status', 'payment_method')
    search_fields = ('order_number', 'user__username', 'shipping_name', 'shipping_phone')
    inlines = [OrderItemInline]
