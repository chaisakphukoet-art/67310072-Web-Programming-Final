import uuid
from django.db import models
from django.contrib.auth.models import AbstractUser

class User(AbstractUser):
    ROLE_CHOICES = [
        ('admin', 'Admin'),
        ('member', 'Member'),
    ]
    email = models.EmailField(unique=True, verbose_name='Email')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='member', verbose_name='Role')
    phone = models.CharField(max_length=20, blank=True, verbose_name='Phone')
    is_email_verified = models.BooleanField(default=False, verbose_name='Email Verified')
    verification_code = models.CharField(max_length=10, blank=True, null=True, verbose_name='OTP Verification Code')
    verification_token = models.CharField(max_length=100, blank=True, null=True, verbose_name='Verification Token')

    def __str__(self):
        return f"{self.username} ({self.role}) - {'Verified' if self.is_email_verified else 'Unverified'}"


class Category(models.Model):
    name = models.CharField(max_length=100, unique=True, verbose_name='Category Name')
    slug = models.SlugField(max_length=100, unique=True, verbose_name='Slug')
    description = models.TextField(blank=True, verbose_name='Description')
    icon = models.CharField(max_length=50, default='bi-laptop', verbose_name='Bootstrap Icon')

    class Meta:
        verbose_name_plural = 'Categories'

    def __str__(self):
        return self.name


class Product(models.Model):
    name = models.CharField(max_length=200, verbose_name='Product Name')
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True, related_name='products', verbose_name='Category')
    brand = models.CharField(max_length=100, blank=True, verbose_name='Brand')
    price = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='Price (THB)')
    stock = models.IntegerField(default=10, verbose_name='Stock Quantity')
    description = models.TextField(blank=True, verbose_name='Description')
    specs = models.TextField(blank=True, verbose_name='Technical Specs')
    image_url = models.URLField(max_length=500, blank=True, verbose_name='Image URL')
    is_featured = models.BooleanField(default=False, verbose_name='Featured Product')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Created At')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Updated At')

    def __str__(self):
        return f"{self.name} - ฿{self.price:,}"


class Order(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('shipped', 'Shipped'),
        ('delivered', 'Delivered'),
        ('cancelled', 'Cancelled'),
    ]

    order_number = models.CharField(max_length=32, unique=True, verbose_name='Order Number')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='orders', verbose_name='User')
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, verbose_name='Total Amount')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', verbose_name='Order Status')
    shipping_name = models.CharField(max_length=100, verbose_name='Recipient Name')
    shipping_address = models.TextField(verbose_name='Shipping Address')
    shipping_phone = models.CharField(max_length=20, verbose_name='Contact Phone')
    payment_method = models.CharField(max_length=50, default='PromptPay / QR Code', verbose_name='Payment Method')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Created At')

    def __str__(self):
        return f"Order #{self.order_number} by {self.user.username} (฿{self.total_amount:,})"


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items', verbose_name='Order')
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True, blank=True, verbose_name='Product')
    product_name = models.CharField(max_length=200, verbose_name='Product Name')
    price = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='Unit Price')
    quantity = models.PositiveIntegerField(default=1, verbose_name='Quantity')
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='Subtotal')

    def __str__(self):
        return f"{self.product_name} x {self.quantity}"
