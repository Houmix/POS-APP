from django.contrib import admin
from .views import *
from django.urls import path, include
#customer/information
urlpatterns = [
    #Endpoints for GroupMenu + Menu (don't forget extra price for menu)
    #Endpoints for Steps if menu and options if extra


    #path("api/createGroupMenu/",GroupMenuCreate.as_view(), name="api_create_GroupMenu"),
    path("api/getGroupMenuList/<int:id_restaurant>/",GroupMenuList.as_view(), name="api_get_GroupMenu_list"),
    #path("api/getGroupMenu/<int:restaurant>/",GroupMenuDetail.as_view(), name="api_get_GroupMenu_detail"),
    path("api/updateGroupMenu/",GroupMenuUpdate.as_view(), name="api_update_GroupMenu"),
    #path("api/deleteGroupMenu/<int:pk>/",GroupMenuDelete.as_view(), name="api_delete_GroupMenu"),


    #path("api/createMenu/",MenuCreate.as_view(), name="api_create_menu"),
    path("api/getAllMenu/<int:id_restaurant>/",MenuList.as_view(), name="api_get_menu_list"),
    path("api/getMenu/<int:id_menu>&<int:id_restaurant>/",MenuDetail.as_view(), name="api_get_menu_detail"),
    path("api/updateMenu/",MenuUpdate.as_view(), name="api_update_menu"),
    #path("api/deleteMenu/<int:pk>/",MenuDelete.as_view(), name="api_delete_menu"),

    #path("api/createOption/", OptionCreate.as_view(), name="api_create_option"),
    path("api/getOption/<int:pk>/", OptionDetail.as_view(), name="api_get_option_detail"),
    path("api/getOption/", OptionList.as_view(), name="api_get_option_list"),
    path("api/updateOption/", OptionUpdate.as_view(), name="api_update_option"),
    #path("api/deleteOption/<int:pk>/", OptionDelete.as_view(), name="api_delete_option"),
    

    #path("api/createStep/", StepCreate.as_view(), name="api_create_step"),
    path("api/stepListByMenu/<int:menu_id>/", StepListByMenu.as_view(), name="api_get_steps_by_menu"),
    path("api/getSteps/<int:menu_id>/", StepDetail.as_view(), name="api_get_step_detail"),
    path("api/getStep/", StepList.as_view(), name="api_get_step_list"),
    path("api/updateStep/", StepUpdate.as_view(), name="api_update_step"),
    #path("api/deleteStep/<int:pk>/", StepDelete.as_view(), name="api_delete_step"),

    path("api/getStepOption/<int:id_restaurant>/", StepOptionList.as_view(), name="api_get_stepOption_list"),
    path("api/updateStepOption/", StepOptionUpdate.as_view(), name="api_update_stepOption"),
    

]
