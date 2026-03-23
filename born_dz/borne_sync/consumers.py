# borne_sync/consumers.py
import json
from channels.generic.websocket import AsyncWebsocketConsumer

SYNC_GROUP_NAME    = 'bornes_sync_channel'
KDS_GROUP_NAME     = 'kds_channel'
DISPLAY_GROUP_NAME = 'display_channel'

class BorneSyncConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        """Quand une borne se connecte"""
        await self.channel_layer.group_add(
            SYNC_GROUP_NAME,
            self.channel_name
        )
        await self.accept()
        print(f"Borne connectée : {self.channel_name}")

    async def disconnect(self, close_code):
        """Quand une borne se déconnecte"""
        await self.channel_layer.group_discard(
            SYNC_GROUP_NAME,
            self.channel_name
        )
        print(f"Borne déconnectée : {self.channel_name}")

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