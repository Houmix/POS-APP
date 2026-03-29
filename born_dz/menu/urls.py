from django.contrib import admin
from .views import *
from django.urls import path, include

urlpatterns = [
    # ============= GROUP MENU =============
    path("api/createGroupMenu/", GroupMenuCreate.as_view(), name="api_create_GroupMenu"),
    path("api/getGroupMenuList/<int:id_restaurant>/", GroupMenuList.as_view(), name="api_get_GroupMenu_list"),
    path("api/getGroupMenu/<int:pk>/", GroupMenuDetail.as_view(), name="api_get_GroupMenu_detail"),
    path("api/updateGroupMenu/", GroupMenuUpdate.as_view(), name="api_update_GroupMenu"),
    path("api/deleteGroupMenu/<int:pk>/", GroupMenuDelete.as_view(), name="api_delete_GroupMenu"),

    # ============= MENU =============
    path("api/createMenu/", MenuCreate.as_view(), name="api_create_menu"),
    path("api/getAllMenu/<int:id_restaurant>/", MenuList.as_view(), name="api_get_menu_list"),
    path("api/getMenu/<int:id_menu>/<int:id_restaurant>/", MenuDetail.as_view(), name="api_get_menu_detail"),
    path("api/updateMenu/", MenuUpdate.as_view(), name="api_update_menu"),
    path("api/deleteMenu/<int:pk>/", MenuDelete.as_view(), name="api_delete_menu"),

    # ============= OPTION =============
    path("api/createOption/", OptionCreate.as_view(), name="api_create_option"),
    path("api/getOption/<int:pk>/", OptionDetail.as_view(), name="api_get_option_detail"),
    path("api/getOption/", OptionList.as_view(), name="api_get_option_list"),
    path("api/updateOption/", OptionUpdate.as_view(), name="api_update_option"),
    path("api/deleteOption/<int:pk>/", OptionDelete.as_view(), name="api_delete_option"),

    # ============= STEP (restaurant-level) =============
    path("api/steps/", StepListByRestaurant.as_view(), name="api_steps_by_restaurant"),   # GET ?restaurant_id=X
    path("api/createStep/", StepCreate.as_view(), name="api_create_step"),                # POST
    path("api/updateStep/<int:pk>/", StepUpdate.as_view(), name="api_update_step"),       # PUT
    path("api/deleteStep/<int:pk>/", StepDelete.as_view(), name="api_delete_step"),       # DELETE
    path("api/getStep/", StepList.as_view(), name="api_get_step_list"),                   # GET (all, auth)

    # ============= MENU STEP (liaison menu ↔ step) =============
    path("api/stepListByMenu/<int:menu_id>/", StepListByMenu.as_view(), name="api_get_steps_by_menu"),         # GET (kiosk + admin)
    path("api/menuSteps/<int:menu_id>/", MenuStepList.as_view(), name="api_menu_step_list"),                   # GET (admin)
    path("api/menuSteps/create/", MenuStepCreate.as_view(), name="api_menu_step_create"),                      # POST
    path("api/menuSteps/<int:pk>/update/", MenuStepUpdate.as_view(), name="api_menu_step_update"),             # PUT
    path("api/menuSteps/<int:pk>/delete/", MenuStepDelete.as_view(), name="api_menu_step_delete"),             # DELETE

    # ============= STEP OPTION =============
    path("api/getStepOption/<int:id_restaurant>/", StepOptionList.as_view(), name="api_get_stepOption_list"),
    path("api/updateStepOption/", StepOptionUpdate.as_view(), name="api_update_stepOption"),
    path("api/stepOptions/create/", StepOptionCreate.as_view(), name="api_create_stepOption"),                 # POST
    path("api/stepOptions/<int:pk>/delete/", StepOptionDelete.as_view(), name="api_delete_stepOption"),        # DELETE

    # ============= CROSS-SELL =============
    path("api/crosssell/", CrossSellView.as_view(), name="api_crosssell"),
]
