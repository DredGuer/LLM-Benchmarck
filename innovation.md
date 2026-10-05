# État du projet et roadmap

[Prise en main](README.md) · [Architecture](TECHNICAL_README.md) · [Contrat d’export](schemas/README.md)

Mise à jour : **5 octobre 2026**. Ce document distingue les fonctions exécutées aujourd’hui des possibilités décrites par le schéma. Il remplace les anciennes affirmations de prise en charge exhaustive multi-GPU.

## Fonctionnement actuel

| Domaine | État |
|---|---|
| Génération locale et API | Interface multi-runner ; options et accès dépendants du serveur |
| Protocole 0.08 | Chauffe séparée, 1 répétition par défaut, limites de sortie, contexte Auto, chargement/cache observés |
| Inventaire Apple Silicon | CPU/cœurs, RAM unifiée, GPU/cœurs, disques physiques et provenance ; observé sur un M3 Pro |
| Mémoire Ollama | RSS cumulée et allocation déclarée ; mesures distinctes |
| Télémétrie macOS | Swap/compression avant/après, deltas disque, nouveaux événements MLX peak/held si disponibles |
| Exports | Markdown et JSON communautaire v2 ; nom JSON comprenant le modèle |
| Statistiques | Sélection des modèles/catégories/passes, moyennes/médianes, détails repliables, lignes/aires, lissage et prefill |
| Assistant IA | Conclusion et questions à la demande ; modèle local ou API choisi indépendamment |
| Aide | Bulles ! au clic, au clavier et sur mobile |
| Détection Windows/Linux | Collecteurs généraux existants ; couverture dépendante des commandes/pilotes, validation réelle à étendre |

L’inventaire d’un GPU ne démontre pas qu’il participe à l’inférence. Le sélecteur présent dans l’interface peut conseiller un redémarrage manuel via `CUDA_VISIBLE_DEVICES` ; il ne relance ni ne reconfigure automatiquement Ollama et ne certifie pas le placement réel.

## Prochaine validation, mise de côté pendant la documentation

1. Comparer **2 ou 3 modèles** sur le même Mac, mêmes catégories et réglages, avec **3 répétitions**.
2. Examiner débit, prefill, cache, swap et mémoire avant/après ; distinguer variation normale et accumulation à investiguer.
3. Vérifier que les conclusions de l’assistant restent fidèles aux chiffres et signalent les inconnues.

La présence de mémoire conservée ne prouve pas une fuite. Une API externe ne fournit pas les ressources de son serveur via l’inventaire local du client.

## Étapes suivantes

| Étape | Objectif | Critère de validation |
|---|---|---|
| Qualité des campagnes | Conditions de cache/chargement et répétitions documentées, diagnostic des dérives | Résultats sur machine réelle, inconnues conservées |
| Import communautaire manuel | Charger des exports v2, dédupliquer les ID de tests et comparer les conditions | Validation du schéma, limites de taille, unités et cohérence |
| Site communautaire | Comparaison de machines/modèles équivalents et gestion des données partagées | Parcours de consultation/import et règles de données explicites |
| Envoi automatique | Envoi à la demande avec aperçu et autorisation adaptée au futur service | Pas d’envoi implicite, authentification et protection côté serveur |
| Tâches agentiques | Réponse, création de dossier/Markdown et vérification réelle des artifacts | Harness isolé, budgets et évaluateur ; déclaration du modèle insuffisante |
| Exo / plusieurs Mac | Inventaire par nœud, modèle distribué, placements et liens observés | Adaptateur validé sur un cluster réel ; pas de somme naïve des débits |
| Linux/Windows et multi-GPU | Inventaire structuré et VRAM/activité par appareil selon source | Tests sur matériel réel NVIDIA/AMD/Intel et sources explicites |
| SSD/offload | Attribuer les lectures/placements lorsque le runner l’expose | L’activité disque seule ne suffit pas à conclure à un offload |

## Ce qui est préparé, sans exécution actuelle

Le schéma v2 décrit plusieurs CPU/GPU/nœuds, des placements demandés et observés, des liens et des tâches agentiques. Les fixtures Apple-agentic, Exo et Linux-multigpu sont **synthétiques**. Elles valident un contrat, pas une collecte complète ni un orchestrateur déjà disponible.

Chaque étape sera intégrée progressivement avec ses tests et sa documentation. Les captures du README viendront après la remise à jour documentaire. Voir [la règle de contribution](CONTRIBUTING.md).
