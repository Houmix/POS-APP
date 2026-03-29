# stock/models.py
# ==========================================
# Gestion de Stock Quantitatif Dynamique
# ==========================================
# Suit en temps reel les quantites de chaque ingredient/produit :
# canettes, portions de viande, grammages de sauce, pains, etc.
# Deduction automatique a chaque commande validee.
# Alertes quand le stock passe sous le seuil minimum.

from django.db import models
from django.core.validators import MinValueValidator
from restaurant.models import Restaurant


class StockCategory(models.Model):
    """
    Categories de stock pour organiser les ingredients.
    Ex: Boissons, Viandes, Sauces, Pains, Emballages...
    """
    restaurant = models.ForeignKey(
        Restaurant, on_delete=models.CASCADE, related_name='stock_categories'
    )
    name = models.CharField(max_length=128, help_text="Ex: Boissons, Viandes, Sauces")
    description = models.CharField(max_length=256, blank=True, default='')
    position = models.IntegerField(default=0)

    class Meta:
        ordering = ['position', 'name']
        unique_together = ('restaurant', 'name')
        verbose_name = "Categorie de stock"
        verbose_name_plural = "Categories de stock"

    def __str__(self):
        return f"{self.name} ({self.restaurant.name})"


class StockItem(models.Model):
    """
    Article de stock unitaire.
    Represente un ingredient ou produit physique avec sa quantite en temps reel.

    Exemples :
        - Coca-Cola 33cl : unite=canette, quantite=48
        - Steak haché 150g : unite=portion, quantite=30
        - Sauce BBQ : unite=gramme, quantite=5000
        - Pain burger : unite=piece, quantite=60
        - Fromage cheddar : unite=tranche, quantite=120
    """
    UNIT_CHOICES = [
        ('piece', 'Piece'),
        ('canette', 'Canette'),
        ('bouteille', 'Bouteille'),
        ('portion', 'Portion'),
        ('gramme', 'Gramme (g)'),
        ('kilogramme', 'Kilogramme (kg)'),
        ('litre', 'Litre (L)'),
        ('centilitre', 'Centilitre (cL)'),
        ('tranche', 'Tranche'),
        ('sachet', 'Sachet'),
        ('carton', 'Carton'),
    ]

    restaurant = models.ForeignKey(
        Restaurant, on_delete=models.CASCADE, related_name='stock_items'
    )
    category = models.ForeignKey(
        StockCategory, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='items'
    )

    # Identification
    name = models.CharField(max_length=200, help_text="Ex: Coca-Cola 33cl, Steak hache 150g")
    sku = models.CharField(
        max_length=50, blank=True, default='',
        help_text="Code article / reference fournisseur (optionnel)"
    )

    # Quantites
    quantity = models.DecimalField(
        max_digits=10, decimal_places=2, default=0,
        validators=[MinValueValidator(0)],
        help_text="Quantite actuelle en stock"
    )
    unit = models.CharField(
        max_length=20, choices=UNIT_CHOICES, default='piece',
        help_text="Unite de mesure"
    )
    weight_per_unit = models.DecimalField(
        max_digits=8, decimal_places=2, default=0,
        help_text="Poids/volume par unite (en grammes ou mL). Ex: 150 pour un steak de 150g"
    )

    # Seuils d'alerte
    min_threshold = models.DecimalField(
        max_digits=10, decimal_places=2, default=10,
        help_text="Seuil minimum : alerte 'stock bas' quand la quantite descend en dessous"
    )
    critical_threshold = models.DecimalField(
        max_digits=10, decimal_places=2, default=3,
        help_text="Seuil critique : alerte 'rupture imminente'. Peut desactiver l'article sur la borne"
    )
    auto_disable = models.BooleanField(
        default=True,
        help_text="Desactiver automatiquement l'article sur la borne quand le stock critique est atteint"
    )

    # Prix d'achat (pour calculer la marge)
    cost_price = models.DecimalField(
        max_digits=10, decimal_places=2, default=0,
        help_text="Prix d'achat unitaire (DA)"
    )

    # Fournisseur
    supplier = models.CharField(max_length=200, blank=True, default='')
    supplier_ref = models.CharField(max_length=100, blank=True, default='')

    # Metadata
    is_active = models.BooleanField(default=True)
    version = models.IntegerField(default=1)
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['category', 'name']
        indexes = [
            models.Index(fields=['restaurant', 'is_active']),
            models.Index(fields=['restaurant', 'category']),
        ]
        verbose_name = "Article de stock"
        verbose_name_plural = "Articles de stock"

    def __str__(self):
        return f"{self.name} : {self.quantity} {self.get_unit_display()}"

    @property
    def status(self):
        """Retourne le statut du stock : ok, low, critical, out."""
        if self.quantity <= 0:
            return 'out'
        if self.quantity <= self.critical_threshold:
            return 'critical'
        if self.quantity <= self.min_threshold:
            return 'low'
        return 'ok'

    @property
    def total_weight(self):
        """Poids total en stock (quantite x poids par unite)."""
        if self.weight_per_unit:
            return self.quantity * self.weight_per_unit
        return 0


class MenuStockLink(models.Model):
    """
    Liaison entre un article du menu et les ingredients du stock.
    Definit combien de chaque ingredient est consomme par portion.

    Exemple pour un "Classic Burger" :
        - 1 x Pain burger (piece)
        - 1 x Steak hache (portion = 150g)
        - 2 x Tranche cheddar (tranche)
        - 30g de sauce (gramme)
        - 1 x Emballage burger (piece)

    Exemple pour un "Coca-Cola" :
        - 1 x Canette Coca-Cola 33cl (canette)
    """
    menu = models.ForeignKey(
        'menu.Menu', on_delete=models.CASCADE, related_name='stock_links'
    )
    stock_item = models.ForeignKey(
        StockItem, on_delete=models.CASCADE, related_name='menu_links'
    )
    quantity_used = models.DecimalField(
        max_digits=8, decimal_places=2, default=1,
        help_text="Quantite d'ingredient consommee par portion vendue. Ex: 1 canette, 150 grammes"
    )

    class Meta:
        unique_together = ('menu', 'stock_item')
        verbose_name = "Lien menu-stock"
        verbose_name_plural = "Liens menu-stock"

    def __str__(self):
        return f"{self.menu.name} utilise {self.quantity_used} {self.stock_item.get_unit_display()} de {self.stock_item.name}"


class OptionStockLink(models.Model):
    """
    Liaison entre une option/supplement et le stock.
    Ex: Option "Cheddar supplementaire" consomme 1 tranche de cheddar.
    """
    option = models.ForeignKey(
        'menu.Option', on_delete=models.CASCADE, related_name='stock_links'
    )
    stock_item = models.ForeignKey(
        StockItem, on_delete=models.CASCADE, related_name='option_links'
    )
    quantity_used = models.DecimalField(
        max_digits=8, decimal_places=2, default=1,
        help_text="Quantite consommee par utilisation de l'option"
    )

    class Meta:
        unique_together = ('option', 'stock_item')
        verbose_name = "Lien option-stock"
        verbose_name_plural = "Liens option-stock"

    def __str__(self):
        return f"Option {self.option.name} utilise {self.quantity_used} de {self.stock_item.name}"


class StockMovement(models.Model):
    """
    Historique de tous les mouvements de stock (entrees et sorties).
    Tracabilite complete : qui, quoi, quand, pourquoi.
    """
    TYPE_CHOICES = [
        ('in', 'Entree (reception fournisseur)'),
        ('out', 'Sortie (commande client)'),
        ('adjustment', 'Ajustement (inventaire)'),
        ('waste', 'Perte / dechet'),
        ('return', 'Retour fournisseur'),
        ('transfer', 'Transfert inter-restaurant'),
    ]

    stock_item = models.ForeignKey(
        StockItem, on_delete=models.CASCADE, related_name='movements'
    )
    movement_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    quantity = models.DecimalField(
        max_digits=10, decimal_places=2,
        help_text="Quantite mouvementee (positive=entree, negative=sortie)"
    )
    quantity_before = models.DecimalField(
        max_digits=10, decimal_places=2,
        help_text="Stock avant le mouvement"
    )
    quantity_after = models.DecimalField(
        max_digits=10, decimal_places=2,
        help_text="Stock apres le mouvement"
    )

    # Contexte
    reason = models.CharField(max_length=255, blank=True, default='')
    order_id = models.IntegerField(
        null=True, blank=True,
        help_text="ID de la commande qui a declenche la sortie (si applicable)"
    )
    user_phone = models.CharField(max_length=20, blank=True, default='')

    # Cout
    unit_cost = models.DecimalField(
        max_digits=10, decimal_places=2, default=0,
        help_text="Cout unitaire au moment du mouvement"
    )

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['stock_item', '-created_at']),
            models.Index(fields=['movement_type', '-created_at']),
        ]
        verbose_name = "Mouvement de stock"
        verbose_name_plural = "Mouvements de stock"

    def __str__(self):
        direction = '+' if self.quantity > 0 else ''
        return f"{direction}{self.quantity} {self.stock_item.name} ({self.get_movement_type_display()})"


class StockAlert(models.Model):
    """
    Alertes de stock automatiques.
    Generees quand un article passe sous le seuil minimum ou critique.
    """
    LEVEL_CHOICES = [
        ('low', 'Stock bas'),
        ('critical', 'Stock critique'),
        ('out', 'Rupture de stock'),
    ]

    stock_item = models.ForeignKey(
        StockItem, on_delete=models.CASCADE, related_name='alerts'
    )
    level = models.CharField(max_length=10, choices=LEVEL_CHOICES)
    message = models.CharField(max_length=255)
    current_quantity = models.DecimalField(max_digits=10, decimal_places=2)
    threshold = models.DecimalField(max_digits=10, decimal_places=2)
    is_resolved = models.BooleanField(default=False)
    resolved_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = "Alerte de stock"
        verbose_name_plural = "Alertes de stock"

    def __str__(self):
        status = 'Resolue' if self.is_resolved else 'Active'
        return f"[{status}] {self.get_level_display()} - {self.stock_item.name} ({self.current_quantity})"
