
from django.contrib import admin # type: ignore
from django.urls import path, include # type: ignore
from .views import *
from rest_framework_simplejwt import views as jwt_views # type: ignore


urlpatterns = [
    path("api/getEmployee/", EmployeeLogin.as_view(), name="api_get_user"),

    path('api/create_token/', jwt_views.TokenObtainPairView.as_view(), name='api_create_token'),
    path('api/user/token/<str:phone>', UserTokenView.as_view(), name='customer_token_obtain'),
    path('api/employee/token/', EmployeeTokenView.as_view(), name='employee_token_obtain'),

    path("api/createCustomer/", UserCreate.as_view(), name="api_create"),
    path("api/getUser/<str:phone>/", UserDetail.as_view(), name="api_get"),
    path('api/user/token/', UserTokenView.as_view(), name='user-token'),
    path('api/getUser/', GetUserByPhone.as_view(), name='get-user-by-phone'),
    path('api/user/<int:pk>/', UserDetail.as_view(), name='user-detail'),

    # ─── RH Employees ───────────────────────────────────────────────────────
    path('api/employees/', EmployeeList.as_view(), name='employee-list'),
    path('api/employees/create/', EmployeeCreateFull.as_view(), name='employee-create'),
    path('api/employees/<int:pk>/', EmployeeDetailFull.as_view(), name='employee-detail'),
    path('api/employees/<int:pk>/update/', EmployeeUpdateFull.as_view(), name='employee-update'),
    path('api/employees/<int:pk>/delete/', EmployeeDeleteFull.as_view(), name='employee-delete'),

    # ─── Pointage ────────────────────────────────────────────────────────────
    path('api/employees/<int:pk>/time-entries/', TimeEntryList.as_view(), name='time-entry-list'),
    path('api/time-entries/<int:pk>/', TimeEntryUpdate.as_view(), name='time-entry-update'),

    # ─── Horaires ────────────────────────────────────────────────────────────
    path('api/employees/<int:pk>/schedules/', ScheduleList.as_view(), name='schedule-list'),
    path('api/schedules/<int:pk>/', ScheduleDelete.as_view(), name='schedule-delete'),

    # ─── Fiches de paie ──────────────────────────────────────────────────────
    path('api/employees/<int:pk>/payslips/', PayslipList.as_view(), name='payslip-list'),

    # ─── Documents ───────────────────────────────────────────────────────────
    path('api/employees/<int:pk>/documents/', DocumentList.as_view(), name='document-list'),
    path('api/documents/<int:pk>/', DocumentDelete.as_view(), name='document-delete'),
]
