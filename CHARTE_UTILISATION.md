# Charte d'utilisation, données et limites de garantie

Version 1.1 — 5 octobre 2026

## Objet et licence

LLM Benchmarker est un outil de benchmark mis à disposition gratuitement par le projet,
sous [licence Apache 2.0](LICENSE). Les dépendances, modèles et services tiers peuvent
avoir leurs propres licences, conditions et tarifs.

Cette charte explique les risques et les précautions d'utilisation. Elle ne modifie
pas la licence Apache 2.0 et n'ajoute pas de restriction aux droits qu'elle accorde.
Elle ne constitue pas une certification de sécurité ou de conformité réglementaire.

## Logiciel fourni en l'état

Le logiciel est fourni en l'état. Dans les limites prévues par la licence et le droit
applicable, les auteurs et contributeurs n'accordent pas de garantie de fonctionnement,
de disponibilité, d'exactitude des résultats, d'adéquation à un besoin particulier,
de conservation des données ou de sécurité absolue.

L'absence de défauts, de perte de données, d'accès non autorisé ou de fuite de données
n'est pas garantie. Les exclusions de garantie et limitations de responsabilité sont
celles des sections 7 et 8 de la licence Apache 2.0, avec leurs réserves légales.
Cette charte n'exclut aucune responsabilité ni aucun droit qui ne pourrait légalement
être exclu. Une utilisation gratuite ne supprime pas les obligations légales applicables.

## Données et services externes

L'utilisateur choisit les données qu'il saisit et les serveurs auxquels il se connecte.

- Avec un runner local, les prompts sont transmis au serveur sélectionné. Une adresse
  distante ou un runner configuré autrement peut entraîner un transfert hors de la machine.
- Avec une API externe, les prompts et les informations d'authentification nécessaires
  sont envoyés au fournisseur. Son traitement des données relève de ses propres conditions.
- Les clés API sauvegardées pour les benchmarks et l'historique sont stockés dans le navigateur. Le stockage local ne
  constitue pas une garantie de chiffrement, de confidentialité ou de sauvegarde.
- Le backend peut exposer des informations sur la machine et les processus. Les logs
  peuvent contenir des informations techniques identifiantes.
- Les exports Markdown contiennent les prompts et réponses. Le bloc JSON communautaire
  est plus restreint, mais il faut vérifier le fichier entier avant de le partager.

L’assistant d’analyse est un service distinct du benchmark : il est lancé à la demande avec un modèle local ou une API choisie par l’utilisateur. Il peut consulter l’historique disponible, la sélection des statistiques ou la campagne affichée, avec des mentions @ pour cibler les modèles testés. Il transmet des synthèses calculées sur toutes les passes du périmètre, jusqu’à 100 détails récents, des mesures/réglages et caractéristiques matérielles synthétiques, la question et les échanges récents, sans les prompts, réponses et logs des tests. Pour une API distante, une autorisation d’envoi est demandée dans le panneau. La clé propre à ce panneau reste dans la page et n’est pas sauvegardée ni exportée. Les conclusions de l’IA peuvent contenir des erreurs et doivent être vérifiées ; elles ne constituent pas une certification des résultats.

Une fois partagé, un rapport peut être copié, réutilisé ou rendu public par son destinataire.
Le projet ne garantit pas la maîtrise des copies diffusées par l'utilisateur.
La licence du logiciel n'attribue pas automatiquement une licence aux données des rapports.

## Précautions à prendre

L'utilisateur doit disposer des droits et autorisations nécessaires pour tester,
traiter ou partager les données utilisées et respecter les règles qui lui sont applicables.

Avant un test ou un partage :

1. Utiliser de préférence des données fictives ou non confidentielles.
2. Ne pas insérer de mots de passe, clés API ou autres secrets dans les prompts et rapports.
3. Vérifier et retirer les données personnelles, documents privés, chemins locaux et logs
   qui n'ont pas vocation à être publiés, y compris ceux concernant des tiers.
4. Sauvegarder les fichiers importants et les rapports à conserver ; le stockage du
   navigateur peut être supprimé.
5. Contrôler les coûts des API, la charge mémoire, le stockage disponible et la durée des tests.
6. Garder les composants à jour et ne pas exposer les serveurs de développement ou le backend
   sur un réseau non maîtrisé sans protections adaptées.

L'utilisateur évalue l'adéquation du logiciel à son usage. Le projet ne garantit pas
que son utilisation suffit à respecter le RGPD, les conditions d'un fournisseur ou
les obligations propres à une organisation.

## Tâches agentiques et fonctions prévues

La batterie agentique utilise des outils déclarés dans un dossier
temporaire dédié, sans shell, accès aux documents personnels ni réseau depuis les outils.
Le modèle est appelé sur le runner local. Les chemins et budgets sont contrôlés par
l’application ; ce n’est pas une sandbox du système d’exploitation. Les fichiers créés
sont supprimés après vérification, mais leurs contenus retournés et les traces de messages,
réflexion rapportée et appels restent dans l’historique local. Les fichiers peuvent être téléchargés.
Ces traces et contenus sont exclus du profil JSON communautaire et du contexte d’analyse IA. Un arrêt brutal du backend peut laisser un dossier temporaire.
Voir [le scénario et ses limites](backend/AGENTIC_BENCHMARK.md). Les futures tâches
plus larges nécessiteront leurs propres protections.

## Futur site communautaire

L'envoi automatique au futur site n'est pas activé dans l'application actuelle.
Avant son ouverture, le service devra préciser son exploitant, les données reçues,
les finalités, la base légale applicable, les destinataires, les durées de conservation,
les droits et moyens de contact. Ses obligations éventuelles de sécurité et de protection
des données ne pourront pas être transférées aux utilisateurs par cette charte.

## Incident

Si une clé a été exposée, la révoquer auprès du fournisseur concerné. Si des données
confidentielles ont été partagées, demander leur retrait au destinataire ou au service.
Avant de publier un signalement GitHub, retirer les secrets et données personnelles.
Cette charte ne promet pas de service d'assistance ni de délai de résolution.

## Références

- [Licence du dépôt](LICENSE)
- [Apache 2.0 — texte officiel, sections 7 et 8](https://www.apache.org/licenses/LICENSE-2.0)
- [CNIL — responsabilités et sécurité des traitements, articles 24 et 32](https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre4)

Le texte anglais de la licence reste la référence ; les explications françaises de cette
charte ne le remplacent pas. Une validation juridique adaptée à la situation de l'exploitant
est à prévoir avant l'ouverture du service communautaire.
