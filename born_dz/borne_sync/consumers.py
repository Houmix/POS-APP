# borne_sync/consumers.py
import json
from channels.generic.websocket import AsyncWebsocketConsumer

SYNC_GROUP_NAME    = 'bornes_sync_channel'
KDS_GROUP_NAME     = 'kds_channel'
DISPLAY_GROUP_NAME = 'display_channel'
CONTROL_ALL_GROUP  = 'borne_control_all'

# Registre des bornes connectées: {borne_id: {channel_name, restaurant_id, ip}}
_connected_bornes: dict = {}

# Taille maximale d'un message WebSocket (1 Mo)
MAX_WS_MESSAGE_SIZE = 1_048_576


class BorneSyncConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        """Quand une borne se connecte"""
        # Extraire restaurant_id depuis la query string pour isoler par restaurant
        query_string = self.scope.get('query_string', b'').decode()
        params = dict(p.split('=', 1) for p in query_string.split('&') if '=' in p)
        self.restaurant_id = params.get('restaurant_id', 'default')

        # Groupe spécifique au restaurant (isolation multi-tenant)
        self.group_name = f'{SYNC_GROUP_NAME}_{self.restaurant_id}'

        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )
        # Aussi ajouter au groupe global (pour broadcast admin)
        await self.channel_layer.group_add(
            SYNC_GROUP_NAME,
            self.channel_name
        )
        await self.accept()
        print(f"Borne connectée : {self.channel_name} (restaurant={self.restaurant_id})")

    async def disconnect(self, close_code):
        """Quand une borne se déconnecte"""
        await self.channel_layer.group_discard(
            getattr(self, 'group_name', SYNC_GROUP_NAME),
            self.channel_name
        )
        await self.channel_layer.group_discard(
            SYNC_GROUP_NAME,
            self.channel_name
        )
        print(f"Borne déconnectée : {self.channel_name}")

    async def receive(self, text_data=None, bytes_data=None):
        """Réception de messages depuis la borne — validation de taille."""
        data = text_data or (bytes_data.decode() if bytes_data else '')
        if len(data) > MAX_WS_MESSAGE_SIZE:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Message trop volumineux (max 1 Mo)'
            }))
            return
        # Pour l'instant on ne traite pas les messages entrants des bornes

    async def sync_message(self, event):
        """
        Reçoit le message du signal et l'envoie à la borne
        C'est ICI que le message arrive depuis force_borne_reload()
        """
        await self.send(text_data=json.dumps({
            'type': 'sync_message',
            'data': event['data']
        }))
        print(f" Message de sync envoyé à la borne")


class DisplayConsumer(AsyncWebsocketConsumer):
    """WebSocket pour l'écran d'affichage client (IPTV)."""

    async def connect(self):
        await self.channel_layer.group_add(DISPLAY_GROUP_NAME, self.channel_name)
        await self.accept()
        print(f"[DISPLAY] Écran client connecté : {self.channel_name}")

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(DISPLAY_GROUP_NAME, self.channel_name)
        print(f"[DISPLAY] Écran client déconnecté : {self.channel_name}")

    async def display_message(self, event):
        """Relaie les événements commande vers l'écran client."""
        await self.send(text_data=json.dumps({
            'type': 'display_message',
            'data': event['data'],
        }))


class BorneControlConsumer(AsyncWebsocketConsumer):
    """
    WebSocket de contrôle par borne (gestion à distance).
    URL : ws/borne/control/?borne_id=BORNE_1&restaurant_id=1
    La borne s'enregistre ici. Le POS envoie des commandes via REST → channel_layer.
    Commandes : update_images, update_all, reboot, disable, enable
    """

    async def connect(self):
        qs = self.scope.get('query_string', b'').decode()
        params = dict(p.split('=', 1) for p in qs.split('&') if '=' in p)
        self.borne_id       = params.get('borne_id', self.channel_name[:8])
        self.restaurant_id  = params.get('restaurant_id', 'default')
        self.borne_group    = f'borne_ctrl_{self.borne_id}'

        await self.channel_layer.group_add(self.borne_group, self.channel_name)
        await self.channel_layer.group_add(CONTROL_ALL_GROUP, self.channel_name)
        await self.accept()

        _connected_bornes[self.borne_id] = {
            'channel': self.channel_name,
            'restaurant_id': self.restaurant_id,
            'borne_id': self.borne_id,
        }
        print(f"[CTRL] Borne {self.borne_id} connectée")

    async def disconnect(self, close_code):
        _connected_bornes.pop(self.borne_id, None)
        await self.channel_layer.group_discard(self.borne_group, self.channel_name)
        await self.channel_layer.group_discard(CONTROL_ALL_GROUP, self.channel_name)
        print(f"[CTRL] Borne {self.borne_id} déconnectée")

    async def receive(self, text_data=None, bytes_data=None):
        # Les bornes peuvent envoyer leur statut ici (ex: ack d'une commande)
        pass

    async def borne_command(self, event):
        """Relaie une commande vers la borne."""
        await self.send(text_data=json.dumps({
            'type': 'borne_command',
            'command': event['command'],
            'payload': event.get('payload', {}),
        }))


class KDSConsumer(AsyncWebsocketConsumer):
    """WebSocket pour l'écran KDS (cuisine)."""

    async def connect(self):
        await self.channel_layer.group_add(KDS_GROUP_NAME, self.channel_name)
        await self.accept()
        print(f"[KDS] Écran connecté : {self.channel_name}")

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(KDS_GROUP_NAME, self.channel_name)
        print(f"[KDS] Écran déconnecté : {self.channel_name}")

    async def kds_message(self, event):
        """Relaie les événements commandes (new_order, order_updated) vers l'écran KDS."""
        await self.send(text_data=json.dumps({
            'type': 'kds_message',
            'data': event['data'],
        }))
        print(f"[KDS] Message envoyé : {event['data'].get('type')}")