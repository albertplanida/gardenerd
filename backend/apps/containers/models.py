from django.db import models

CONTAINER_NAME_MAX_LENGTH = 255


class Container(models.Model):
    name = models.CharField(max_length=CONTAINER_NAME_MAX_LENGTH)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name
