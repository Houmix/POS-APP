# from django.db.models.signals import post_save
# from django.dispatch import receiver
# from .models import User
# from manager.models import Manager
# from POS.models import Cashier
# from customer.models import Customer

# @receiver(post_save, sender=User)
# def create_user_profile(sender, instance, created, **kwargs):
#     if created:
#         if instance.role == 'manager':
#             Manager.objects.create(user=instance)
#         elif instance.role == 'cashier':
#             Cashier.objects.create(user=instance)
#         elif instance.role == 'customer':
#             Customer.objects.create(user=instance)