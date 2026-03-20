from django import forms
from django.contrib.auth.forms import UserCreationForm
from user.models import Employee
from django.core.mail import send_mail
from restaurant.models import KioskConfig
from django.utils.crypto import get_random_string
from django.urls import reverse
from django.conf import settings
from django.contrib.auth.hashers import check_password
from restaurant import models
from user.models import User


class new_passwordForm:
    password = forms.CharField(widget=forms.PasswordInput(attrs={'placeholder': 'Mot de passe'}))
    password2=forms.CharField(widget=forms.PasswordInput(attrs={'placeholder': 'Repeter votre mot de passe'}))

    def clean(self):

        cleaned_data=super (SignUpForm, self).clean()
        password=cleaned_data.get('password')
        password2=cleaned_data.get('password2')
        if password!=password2:
            raise forms.ValidationError("Les mots de passes sont distincts")
        return password
    


class passwordForgetForm(forms.ModelForm):
    email = forms.CharField(max_length=128,widget=forms.TextInput(attrs={'placeholder': 'Adresse email'}))


    class Meta :
        model = Employee
        exclude = ('is_staff', 'is_active','date_joined','groups','user_permissions','is_superuser','last_login','password')
        fields = ['email']#Give the order that will be displayed in the register form

    def clean(self):
        cleaned_data=super (SignUpForm, self).clean()
        email=cleaned_data.get('email')
        email = email.lower()

    
    def save(self, commit=True):
        user = super().save(commit=True)#Commit = False don't let django save this user in the DB as an active account. is_active=0
        user.token = get_random_string(length=32)  # Generate a unique token
        #user.username = self.cleaned_data['username']
        user.save()
        send_password_email(user)
        return user
    
def send_password_email(user):
    activation_link = reverse('new_password', args=[user.token])
    activation_url = f'{settings.BASE_URL}{activation_link}'
    subject = 'changement de mot de passe '
    message = f'Veuillez cliquer sur le lien afin de modifier votre mot de passe \n{activation_url}'
    send_mail(subject, message, settings.EMAIL_HOST_USER, [user.email]) 


class ContactUsForm(forms.Form):
    name = forms.CharField(
        label="",
        max_length=100,
        widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Votre nom'})
    )
    mail = forms.EmailField(
        label="",
        widget=forms.EmailInput(attrs={'class': 'form-control', 'placeholder': 'Votre email'})
    )
    subject = forms.CharField(
        label="",
        max_length=200,
        widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Sujet de votre message'})
    )
    message = forms.CharField(
        label="",
        widget=forms.Textarea(attrs={'class': 'form-control', 'rows': 5, 'placeholder': 'Votre message'})
    )
    
    # agree_to_terms = forms.BooleanField(
    #     label="J'accepte les termes et conditions",
    #     required=True
    # )

    def clean(self):
        cleaned_data = super(ContactUsForm, self).clean()
        name=cleaned_data.get('name')
        email = cleaned_data.get('email')
        subject=cleaned_data.get("subject")
        message=cleaned_data.get("message")
        full_message = f"Nom: {name}\nEmail: {email}\n\nMessage:\n{message}"

        send_mail(
                subject,
                full_message,
                email,  # L'expéditeur (le mail du client)
                ['contact@menugo-dz.com'],  # Destinataire (ton mail)
                fail_silently=False,
            )
        
class UserContactUsForm(forms.Form):
    user_id = forms.IntegerField(widget=forms.HiddenInput())  # Champ caché pour l'ID de l'utilisateur
    subject = forms.CharField(
        label="Sujet",
        max_length=200,
        widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Sujet de votre message'})
    )
    message = forms.CharField(
        label="Message",
        widget=forms.Textarea(attrs={'class': 'form-control', 'rows': 5, 'placeholder': 'Votre message'})
    )

    def clean(self):
        cleaned_data = super(UserContactUsForm, self).clean()
        user_id = cleaned_data.get("user_id")
        subject = cleaned_data.get("subject")
        message = cleaned_data.get("message")

        # Récupérer l'utilisateur à partir de l'ID
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            raise forms.ValidationError("Utilisateur introuvable.")

        name = user.get_full_name()
        email = user.email
        full_message = f"Nom: {name}\nEmail: {email}\n\nMessage:\n{message}"

        # Envoyer l'email
        send_mail(
            subject,
            full_message,
            email,  # L'expéditeur (le mail du client)
            ['borndz213@gmail.com'],  # Destinataire (ton mail)
            fail_silently=False,
        )
            

            


    

class KioskConfigForm(forms.ModelForm):
    class Meta:
        model = KioskConfig
        fields = [
            'primary_color', 'secondary_color',
            'background_color', 'card_bg_color', 'text_color',
            'sidebar_color', 'category_bg_color', 'selected_category_bg_color', 'category_text_color',
            'logo', 'screensaver_image', 'screensaver_video',
            'card_style', 'composition_mode',
        ]
        widgets = {
            'primary_color':              forms.TextInput(attrs={'class': 'form-control'}),
            'secondary_color':            forms.TextInput(attrs={'class': 'form-control'}),
            'background_color':           forms.TextInput(attrs={'class': 'form-control'}),
            'card_bg_color':              forms.TextInput(attrs={'class': 'form-control'}),
            'text_color':                 forms.TextInput(attrs={'class': 'form-control'}),
            'sidebar_color':              forms.TextInput(attrs={'class': 'form-control'}),
            'category_bg_color':          forms.TextInput(attrs={'class': 'form-control'}),
            'selected_category_bg_color': forms.TextInput(attrs={'class': 'form-control'}),
            'category_text_color':        forms.TextInput(attrs={'class': 'form-control'}),
            'card_style':                 forms.Select(attrs={'class': 'form-select'}),
            'composition_mode':           forms.Select(attrs={'class': 'form-select'}),
            'logo':                       forms.ClearableFileInput(attrs={'class': 'form-control'}),
            'screensaver_image':          forms.ClearableFileInput(attrs={'class': 'form-control'}),
            'screensaver_video':          forms.ClearableFileInput(attrs={'class': 'form-control'}),
        }


class LoginForm(forms.Form):
    mail=forms.EmailField(
        label="Email" 
    )
    password=forms.CharField(
        label="Password",
        strip=False,
        widget=forms.PasswordInput(attrs={'autocomplete': 'new-password'}),
    )
    def clean(self):
        cleaned_data = super(LoginForm, self).clean()
        email = cleaned_data.get('mail')
        email = str(email).lower()
        password = cleaned_data.get('password')
        
        if email and password:
            try:
                user = User.objects.get(email=email)
            except User.DoesNotExist:
                raise forms.ValidationError("Adresse email ou mot de passe incorrect")

            if not check_password(password, user.password):
                raise forms.ValidationError("Adresse email ou mot de passe incorrect")

            if not user.is_active:
                raise forms.ValidationError("Activez votre compte")
            return cleaned_data
        



class SignUpForm(forms.ModelForm):
    password = forms.CharField(widget=forms.PasswordInput(attrs={'placeholder': 'Mot de passe'}))
    password2=forms.CharField(widget=forms.PasswordInput(attrs={'placeholder': 'Mot de passe'}))
    email = forms.CharField(max_length=128,widget=forms.TextInput(attrs={'placeholder': 'Adresse email'}))


    class Meta :
        model = Employee
        exclude = ('is_staff', 'is_active','date_joined','groups','user_permissions','is_superuser','last_login')
        fields = [ 'email','password']#Give the order that will be displayed in the register form
    


    def clean(self):
        cleaned_data=super (SignUpForm, self).clean()
        email=cleaned_data.get('email')
        email = email.lower()
        password1=cleaned_data.get('password')
        password2=cleaned_data.get('password2')
        if password1!=password2:
            raise forms.ValidationError("Les mots de passes sont distincts")
        result = Employee.objects.filter(email=email)
        if len(result)==1:
            raise forms.ValidationError("Adresse e-mail déja reliée à un compte existant")
        return cleaned_data
    def save(self, commit=True):
        user = super().save(commit=True)#Commit = False don't let django save this user in the DB as an active account. is_active=0
        user.password = self.cleaned_data['password']#Hash the password in the models methode
        user.token = get_random_string(length=32)  # Generate a unique token
        user.is_active = False#activate his account
        #user.username = self.cleaned_data['username']
        user.save()
        send_account_creation_mail(user)
        send_activation_email(user)
        return user
def send_account_creation_mail(user):
    subject = 'Compte crée'
    message = "Votre compte a été crée avec succès.\nL'équipe DZ Born"
    send_mail(subject, message, settings.EMAIL_HOST_USER, [user.email])
def send_activation_email(user):
    activation_link = reverse('activate_account', args=[user.token])
    activation_url = f'{settings.BASE_URL}{activation_link}'
    subject = 'Activez votre compte'
    message = f'Hey !\nRavi de vous compter parmis nous.\nCliquez sur le lien ci-dessous pour activer votre compte:\n{activation_url}'
    send_mail(subject, message, settings.EMAIL_HOST_USER, [user.email])


