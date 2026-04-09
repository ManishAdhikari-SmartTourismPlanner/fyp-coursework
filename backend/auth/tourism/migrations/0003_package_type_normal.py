from django.db import migrations, models


def forward_convert_budget_to_normal(apps, schema_editor):
    Package = apps.get_model('tourism', 'Package')

    for package in Package.objects.filter(package_type='budget'):
        package.package_type = 'normal'
        if package.slug and package.slug.endswith('-budget'):
            package.slug = package.slug[:-7] + '-normal'
        if package.title and 'Budget Package' in package.title:
            package.title = package.title.replace('Budget Package', 'Normal Package')
        package.save(update_fields=['package_type', 'slug', 'title'])


def reverse_convert_normal_to_budget(apps, schema_editor):
    Package = apps.get_model('tourism', 'Package')

    for package in Package.objects.filter(package_type='normal'):
        package.package_type = 'budget'
        if package.slug and package.slug.endswith('-normal'):
            package.slug = package.slug[:-7] + '-budget'
        if package.title and 'Normal Package' in package.title:
            package.title = package.title.replace('Normal Package', 'Budget Package')
        package.save(update_fields=['package_type', 'slug', 'title'])


class Migration(migrations.Migration):

    dependencies = [
        ('tourism', '0002_alter_package_package_type'),
    ]

    operations = [
        migrations.RunPython(forward_convert_budget_to_normal, reverse_convert_normal_to_budget),
        migrations.AlterField(
            model_name='package',
            name='package_type',
            field=models.CharField(
                choices=[('normal', 'Normal'), ('standard', 'Standard'), ('deluxe', 'Deluxe')],
                default='standard',
                max_length=20,
            ),
        ),
    ]
