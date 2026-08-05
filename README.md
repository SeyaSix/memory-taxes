# memory-taxes
 Application web légère (HTML/CSS/JS vanilla) pour suivre son chiffre d'affaires par mois et par client, et calculer automatiquement la part URSSAF à reverser. Données stockées localement via IndexedDB, sans backend ni dépendance. Export/import JSON et export PDF par année inclus.




Budget URSSAF est une application web minimaliste destinée aux indépendants et auto-entrepreneurs pour suivre facilement leur activité mensuelle.

Elle permet de :

Enregistrer chaque recette par mois et par client
Calculer automatiquement la part à reverser à l'URSSAF selon un taux configurable (25,60 % par défaut) et le reste net disponible
Visualiser un récapitulatif par mois et des totaux globaux
Filtrer les recettes par mois ou par client
Exporter/importer l'ensemble des données au format JSON (sauvegarde, transfert entre appareils)
Générer un PDF récapitulatif de l'année choisie, prêt à archiver ou transmettre à un comptable
Le tout fonctionne entièrement côté navigateur : aucune inscription, aucun serveur, aucune donnée envoyée en ligne. Les informations sont stockées localement grâce à IndexedDB, ce qui garantit confidentialité et fonctionnement hors-ligne.
