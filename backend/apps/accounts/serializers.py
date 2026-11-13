from django.conf import settings
from rest_framework import serializers
from django.contrib.auth import authenticate
from .models import User, UserRole


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.ReadOnlyField()
    recovery_codes_remaining = serializers.SerializerMethodField()
    title = serializers.SerializerMethodField()
    advocate_title = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'full_name',
            'title',
            'advocate_title',
            'role',
            'phone_number',
            'is_active',
            'recovery_codes_remaining',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'created_at',
            'updated_at',
            'full_name',
            'recovery_codes_remaining',
            'title',
            'advocate_title',
        ]

    def get_recovery_codes_remaining(self, obj):
        if hasattr(obj, 'recovery_codes'):
            return obj.recovery_codes.filter(consumed_at__isnull=True).count()
        return 0

    def get_title(self, obj):
        return getattr(settings, 'ADVOCATE_TITLE', 'Principal Advocate and Founder')

    def get_advocate_title(self, obj):
        return getattr(settings, 'ADVOCATE_TITLE', 'Principal Advocate and Founder')


class UserProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'email', 'phone_number']
        read_only_fields = ['email']


class UserCreateUpdateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, min_length=12)

    class Meta:
        model = User
        fields = [
            'id',
            'username',
            'email',
            'first_name',
            'last_name',
            'role',
            'phone_number',
            'is_active',
            'password',
        ]

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        user = User(**validated_data)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField(required=True)
    password = serializers.CharField(required=True, write_only=True)

    def validate(self, attrs):
        username = attrs.get('username')
        password = attrs.get('password')
        user = authenticate(username=username, password=password)

        if not user:
            raise serializers.ValidationError('Invalid username or password.')
        if not user.is_active:
            raise serializers.ValidationError('This user account has been deactivated.')

        attrs['user'] = user
        return attrs


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(required=True, write_only=True, min_length=12)

    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('Current password does not match.')
        return value
