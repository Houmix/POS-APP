import json
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from .consumers import _connected_bornes, CONTROL_ALL_GROUP


@api_view(['GET'])
@permission_classes([AllowAny])
def list_bornes(request):
    """Retourne la liste des bornes connectées au WebSocket de contrôle."""
    return Response(list(_connected_bornes.values()))


@api_view(['POST'])
@permission_classes([AllowAny])
def send_borne_command(request, borne_id=None):
    """
    Envoie une commande à une borne spécifique ou à toutes les bornes.
    Body JSON: { "command": "update_images" | "update_all" | "reboot" | "disable" | "enable" }
    URL /api/bornes/command/           → toutes les bornes
    URL /api/bornes/command/<borne_id>/ → borne spécifique
    """
    command = request.data.get('command')
    if not command:
        return Response({'error': 'command requis'}, status=400)

    channel_layer = get_channel_layer()
    if borne_id:
        group = f'borne_ctrl_{borne_id}'
    else:
        group = CONTROL_ALL_GROUP

    async_to_sync(channel_layer.group_send)(
        group,
        {
            'type': 'borne_command',
            'command': command,
            'payload': request.data.get('payload', {}),
        }
    )
    return Response({'status': 'sent', 'command': command, 'target': borne_id or 'all'})
