from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('customer', '0002_initial'),
        ('restaurant', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='CustomerLoyalty',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('customer_identifier', models.CharField(max_length=64)),
                ('points', models.IntegerField(default=0)),
                ('total_spent', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('visit_count', models.IntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('restaurant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='restaurant.restaurant')),
            ],
            options={
                'unique_together': {('customer_identifier', 'restaurant')},
            },
        ),
        migrations.CreateModel(
            name='LoyaltyReward',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=128)),
                ('description', models.TextField(blank=True)),
                ('points_required', models.IntegerField()),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('restaurant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='restaurant.restaurant')),
            ],
        ),
        migrations.CreateModel(
            name='LoyaltyRedemption',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('points_spent', models.IntegerField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('customer_loyalty', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='redemptions', to='customer.customerloyalty')),
                ('reward', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='customer.loyaltyreward')),
            ],
        ),
    ]
