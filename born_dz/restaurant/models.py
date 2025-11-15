
from django.db import models
from chain.models import Chain


class Restaurant(models.Model):
    name = models.CharField(max_length=128)
    address = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    phone = models.CharField(max_length=13)
    immat = models.CharField(max_length=30)
    logo = models.FileField(upload_to="restaurants/logo/", blank=True, null=True)

    chain = models.ForeignKey(Chain, on_delete=models.SET_NULL, null=True, blank=True, related_name="restaurants")

    def __str__(self):
        return self.name

