# borne_sync/consumers.py
import json
from channels.generic.websocket import AsyncWebsocketConsumer

# Le nom du groupe où toutes les bornes vont écouter les alertes
SYNC_GROUP_NAME = 'bornes_sync_channel'

class BorneSyncConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # Joindre le groupe de synchronisation
        await self.channel_layer.group_add(
            SYNC_GROUP_NAME,
            self.channel_name
        )
        await self.accept()
        print(f"Borne connectée : {self.channel_name}")

    async def disconnect(self, close_code):
        # Quitter le groupe
        await self.channel_layer.group_discard(
            SYNC_GROUP_NAME,
            self.channel_name
        )
        print(f"Borne déconnectée : {self.channel_name}")

    # Fonction pour recevoir des messages envoyés via le Channel Layer
    async def sync_message(self, event):
        # Envoie le message broadcasté à la borne
        await self.send(text_data=json.dumps({
            'type': event['type'],
            'data': event['data']
        }))

    # Vous pouvez ignorer la méthode receive (la borne n'envoie rien)
    # async def receive(self, text_data):
    #     pass