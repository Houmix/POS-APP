


from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .models import Chain
from .serializers import ChainSerializer

from rest_framework.permissions import IsAuthenticated

class ChainPOST(APIView):
    permission_classes = [IsAuthenticated] # Seuls les utilisateurs authentifiés peuvent créer un restaurant7
    def post(self, request, *args, **kwargs):
        # a mettre en place try :
        serializer = ChainSerializer(data=request.data) #creation de l'objet
        if serializer.is_valid():
            serializer.save()
            return Response({"message": "Utilisateur créé avec succès", "data": serializer.data}, status=status.HTTP_201_CREATED)
        return Response({"message": "Erreur dans la création de l'utilisateur", "errors": serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

class ChainGET(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request, pk, *args, **kwargs):
        try:
            chain = Chain.objects.get(id=pk)
        except Chain.DoesNotExist:
            return Response({"error": "Utilisateur non trouvé"}, status=status.HTTP_404_NOT_FOUND)
        
        serializer = ChainSerializer(chain)

        return Response(serializer.data, status=status.HTTP_200_OK)

class ChainUPDATE(APIView):
    permission_classes = [IsAuthenticated]
    def put(self, request, *args, **kwargs):
        try:
            chain_id = request.data.get("chain_id")
            chain = Chain.objects.get(id=chain_id)
        except Chain.DoesNotExist:
            return Response({"error": "Utilisateur non trouvé"}, status=status.HTTP_404_NOT_FOUND)

        serializer = ChainSerializer(Chain, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response({"message": "Utilisateur mis à jour", "data": serializer.data}, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)



