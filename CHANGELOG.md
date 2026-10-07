# Changelog

Historique des changements de LLM Benchmarker. Les dates correspondent aux intégrations dans le dépôt. Les entrées antérieures à ce fichier ont été reconstituées à partir des commits ; ce ne sont pas des releases ou tags ajoutés rétroactivement.

## Versions actuelles

| Élément | Version | Référence |
|---|---|---|
| Application / interface / producteur des exports | **0.16.0** | `js/core/version.js` |
| Backend Node | 1.5.0 | `package.json` |
| Protocole de génération | 0.09 | `js/core/benchmark.js` |
| Batterie agentique | 2.0.1 | `backend/agentic-suite.js` |
| Rapport communautaire | 2.2.0 ; compatibilité 2.0.0/2.1.0 | `schemas/community-v2.schema.json` |
| Bundle de rapports communautaires | 1.0.0 | `schemas/community-bundle.schema.json` |
| Catalogue / estimateur | 1.0.0 / 1.0.0 | `backend/model-catalog.json` / `backend/model-advisor.js` |
| Inventaire Apple | 1.0.0 | `backend/apple-inventory.js` |

Ces numéros désignent des composants différents. Les résultats historiques et exemples synthétiques conservent leur version d’origine. Le suffixe des URL de scripts sert à invalider le cache ; il ne désigne pas nécessairement la version de l’application.

## [0.16.0] — 2026-10-07

- Interopérabilité NVNC-Tech ≥ 0.3.1 : contrat communautaire 2.0/2.1/2.2 et bundle 1.0 inchangé, schémas partagés et fixtures produites par l’exporteur réel.
- Attribution locale du runner MLX LM et export du TTFT réellement mesuré corrigés. Endpoint distant distingué du client local.
- Identifiant public du schéma corrigé après renommage du dépôt. Provenance historique et versions des anciens tests préservées.
- Guide export/import, confidentialité, limites et validation croisée ajoutés. Pas d’envoi automatique ni d’intégration Exo.

## [0.15.0] — 2026-10-06

- SQLite local, backend 1.5.0, Node ≥ 22.13 : stockage hors dépôt, transactions, WAL et schéma local 1.
- Sauvegarde après chaque passe ; campagnes avec ID stable, mesures originales immuables, annotations nom/notes/tags et exclusions statistiques persistantes.
- CRUD des campagnes et profils, corbeille restaurable, confirmation de suppression définitive.
- Migration transactionnelle et idempotente du navigateur, copie conservée ; historique, statistiques et assistant utilisent la vue SQLite.
- Sauvegarde JSON locale versionnée avec annotations/corbeille, import fusionné avec détection des conflits ; exports communautaires inchangés.
- Backend lié à 127.0.0.1 ; routes de données réservées aux origines et connexions locales. SQLite ne chiffre pas les résultats. Clés API exclues de la migration/base.
- Versions interface/producteur 0.15.0 ; provenance des anciens tests préservée. Validation : 28 suites passent, dont 3 nouvelles suites SQLite/HTTP réels et frontend simulé ; validation utilisateur Mac à effectuer.

## [0.14.0] — 2026-10-06

- Runners locaux en premier : Ollama, MLX LM et llama.cpp. Fournisseurs API dans un volet repliable ; LM Studio/personnalisé conservés dans Autres connexions, profils compatibles.
- Détection passive des API et installations usuelles ; installé, chargement, API joignable et moteur compatible non confirmé distingués. Aucun téléchargement ou lancement automatique au scan.
- Backend 1.4.0 : plans d’installation acceptés, pilote Apple Silicon dans l’espace utilisateur, ZIP Ollama signé/Gatekeeper, archive llama.cpp b11429 avec SHA-256, MLX LM en venv avec version PyPI choisie au plan et wheels seulement. Sources/recettes fixes, origine locale/jeton, staging/extraction contrôlée, file unique, aucun sudo/shell client/remplacement.
- Démarrage séparé : choix explicite du modèle HF pour MLX/llama.cpp, écoute loopback et contrôle de port ; arrêt uniquement des processus gérés. Les prérequis Python restent requis et les installateurs Linux/Windows sont reportés.
- Runner MLX intégré à la génération streamée (TTFT/usage/réflexion observable), aux profils et au harness agentique selon capacités du modèle ; pas d’attribution de RAM Ollama. Version runner réinitialisée à la sélection pour éviter une provenance périmée.
- Interface/caches/producteur des exports 0.14.0 ; contrat communautaire, protocole et versions historiques conservés. README, guides, contribution et roadmap actualisés.
- Validation : 25 suites passent ; quatre suites ajoutées pour recettes/états/consentement/guards, extraction réelle de ZIP/tar avec rejets, UI et génération MLX. Réseau, signatures, installations, processus et DOM simulés : validation réelle macOS encore requise.

## [0.13.0] — 2026-10-06

- Bouton **Trouver des modèles pour ma machine**, en Simple et Pro : pilote Apple Silicon/Ollama avec RAM physique, réserve et espace libre du volume présumé des modèles ; provenance et hypothèses visibles.
- Catalogue 1.0.0 : 13 familles demandées, 30 variantes standard/MLX et sources datées ; filtres famille, architecture et modalités déclarées. MiniMax-M3 cloud reste visible sans estimation mémoire locale ni installation de poids.
- Estimateur 1.0.0 : fourchette heuristique à confiance faible, contexte recalculable, badges vert/orange/rouge/grisé, inconnues explicites ; tous les poids MoE comptés, sans promesse de qualité/débit/chargement. Estimations exclues des exports de benchmark.
- Backend 1.3.0 : installation explicite séquentielle dans Ollama local, confirmation du chemin, contrôle espace/RAM avec manifeste frais, progression par couche, arrêt sur erreur et annulation. Origine locale, jeton, allowlist, URLs fixes, file unique ; aucun shell ou effacement de modèle.
- Verrouillage des campagnes pendant installation, prévention du contexte périmé, récupération d’une file serveur active à la réouverture et rafraîchissement des modèles après installation. Interface, caches et producteur d’exports 0.13.0 ; formats/protocoles et versions historiques inchangés.
- README, guides backend/technique, contribution et roadmap actualisés ; guide catalogue/formule ajouté.
- Validation : 21 suites passent, dont deux nouvelles suites catalogue/estimation/pull/origine/token et interface/filtres/contexte/verrouillage. Matériel, téléchargement et DOM simulés ; aucun téléchargement multi-GB, chargement réel ni validation visuelle Safari/Chrome dans cet environnement.

## [0.12.1] — 2026-10-06

- Markdown : titre de chaque test avant ses verdicts, évaluateur et version ; suppression de l’association visuelle au test précédent.
- Verdicts : une tâche terminée mais non conforme n’est plus présentée comme une erreur technique. Exécution, objectif atteint, conformité et motif d’arrêt restent distincts.
- Les épreuves arrêtées conservent leurs métriques disponibles, leurs évaluations et artefacts ; les timings absents ne deviennent pas zéro. La bulle swap et les rapports distinguent occupation et échanges système sans attribuer automatiquement un ralentissement au modèle.
- Roadmap : conception des balayages de contexte à bornes/pas/liste manuels ou automatiques, distinction fenêtre allouée/longueur réelle du prompt, budgets, arrêt, répétitions, exports et sous-épreuves agentiques. Non implémenté ; batterie stricte et historique inchangés.
- Application, caches et producteur d’export 0.12.1 ; backend, budgets, protocoles et schémas inchangés. README et documentation technique actualisés.
- Validation : 19 suites passent ; régressions sur ordre des sections Markdown, non-conformité, arrêt après objectif atteint, métriques partielles et provenance historique. DOM/inférence simulés ; pas de nouvelle validation visuelle ou inférence réelle.

## [0.12.0] — 2026-10-06

- Ollama cloud : génération et agentique via le proxy local, reconnaissance par champs API `remote_host`/`remote_model` ou convention de nom explicitement inférée ; aucune adresse distante retenue. La présence dans `/api/ps`, le contexte chargé et le déchargement locaux ne sont plus exigés pour le cloud.
- Campagne cloud contrôlée : une série de trois répétitions à température 0, contexte fournisseur Auto/inconnu ; pas de `num_ctx`, pas de faux contexte validé ni double série locale.
- Campagne locale à deux contextes : déchargement confirmé et rechargement avant chaque contexte. Vérification du contexte réel maintenue, y compris MLX ; chauffe non confirmée conservée et signalée comme résultat partiel, sans génération échouée fictive. Cache système/disque hors contrôle.
- Cartes et Markdown : attribution cloud explicite et mémoire distante inconnue. JSON : client et nœud d’inférence inconnu séparés, télémétrie locale non attribuée au cloud. Statistiques et assistant IA distinguent matériel client/moteur distant.
- Interface, caches et producteur d’export 0.12.0 ; provenance historique préservée. Backend 1.2.0, protocole 0.09, schéma 2.2.0 et bundle 1.0.0 inchangés (champs existants).
- Documentation actualisée, guide cloud/local ajouté, URL d’installation corrigée vers le dépôt renommé LLM-Benchmarker et option Python `--bind` dédoublonnée.
- Validation : 19 suites passent, dont les campagnes cloud réellement parcourues avec flux simulés, aliases API, erreurs fournisseur, exports/provenance/confidentialité, trois répétitions et rechargement local par contexte ; agentique cloud testé avec le sandbox réel. Aucun test d’inférence réelle ni validation visuelle réalisée ici : à confirmer sur le Mac.

## [0.11.0] — 2026-10-06

- En-tête : sélecteur **Interface Simple / Interface Pro** remplaçant les exports JSON et Markdown. Une page partagée ; niveau d’interface mémorisé dans le navigateur.
- Simple : un seul modèle, catégories classiques et justesse présélectionnées, contexte Auto, une répétition, températures par catégorie, tokens réglables. Le bouton agentique active les six épreuves. Ollama utilise la file à un modèle avec exports locaux et déchargement vérifié.
- Pro : cases de sélection multi-modèles directement visibles dans « Modèles à tester », compteur et lancement partagé de la file ; noms complets lisibles. Les réglages avancés restent disponibles.
- Profils nommés : sauvegarde, chargement, mise à jour et suppression, jusqu’à 40 profils locaux versionnés 1.0.0. Modèles, catégories, prompt personnalisé, températures, répétitions, agentique, justesse, contextes et politique d’erreur conservés ; aucune clé API, donnée matérielle ou résultat.
- Les paramètres Pro sont préservés pendant les allers-retours en Simple. Les modèles absents d’un profil sont signalés et bloquent la file ; profils invalides rejetés avant application.
- Exports manuels déplacés dans **Campagne → Autres exports** ; récupération du dossier local conservée. Initialisation des épreuves agentiques avant la capture des réglages et caches JS/CSS actualisés.
- Producteur des exports 0.11.0 ; versions historiques, backend 1.2.0, protocole 0.09 et schéma communautaire inchangés. README, guides et règles de contribution actualisés.
- Validation : 18 suites passent, dont une nouvelle suite basée sur les contrôles du HTML pour le démarrage, les profils après rechargement, Simple/Pro, les sélections, limites et exclusions de secrets. DOM/inférence simulés ; vérification visuelle et modèles réels à réaliser sur le Mac de l’utilisateur.

## [0.10.0] — 2026-10-06

- Campagnes automatiques Ollama : sélection de plusieurs modèles, mêmes catégories/réglages, chauffe distincte, répétitions normales ou campagne contrôlée à deux contextes. Exécution séquentielle, sans tuer de processus.
- Sauvegarde JSON communautaire et Markdown dans `export/`, tri par nom complet de modèle ; noms datés avec identifiant de file, position et suffixe stable anticollision. Dossier exclu de Git.
- Bouton **Récupérer les exports** : ouvre le dossier local via le backend et réessaie une sauvegarde en attente. Les téléchargements manuels restent disponibles.
- File visible, interruption immédiate ou après le modèle, politique d’erreur technique configurable. Les échecs de justesse/conformité restent des résultats. Les erreurs de sauvegarde, d’historique ou de déchargement bloquent le passage au suivant.
- Déchargement explicite Ollama et vérification `/api/ps` avant le modèle suivant. Pas de garantie sur la RAM instantanément restituée ni de synchronisation avec d’autres applications.
- Backend 1.2.0 : nouvelles routes d’export local limitées au bouclage et aux origines locales avec jeton pour les mutations, chemins calculés, validation du JSON et limites de taille ; refus des traversées, liens symboliques et écrasements.
- Génération Markdown factorisée ; interface et producteur d’export 0.10.0, provenance historique préservée. Protocole de génération et formats communautaires inchangés.
- README et guides actualisés, commandes Python liées au bouclage local, limites de confidentialité des Markdown précisées.
- Validation : 17 suites passent ; suites stockage/export et campagne multi-modèles ajoutées ; moteurs et inférence simulés, fichiers réellement écrits dans des dossiers temporaires. Tests matériel/gestionnaire de fichiers natif à réaliser sur la machine de l’utilisateur.

## [0.09.0] — 2026-10-06

Les quatre volets de fiabilisation ont été réalisés dans cet ordre et publiés ensemble.

### 1. Provenance

- Version d’application capturée au moment de chaque nouvelle passe ; distincte de la version du producteur d’export. Les anciens historiques restent explicitement inconnus.
- Client navigateur distingué du runner et du moteur/backend non rapporté. Localisation d’endpoint déclarée sans exporter son URL ou ses secrets.
- MLX : horodatage de l’événement maximal corrigé, collecte séparée, âge/fraîcheur, événements futurs exclus et chevauchements de télémétrie signalés. Attribution au modèle toujours non vérifiée.
- Backend 1.1.0 et schéma communautaire 2.2.0 ; anciens rapports conservés et compatibles.

### 2. Verdicts

- Exécution terminée, interruption/erreur technique, objectif atteint, conformité et justesse séparés.
- Critères échoués visibles immédiatement. Un échec de conformité n’est plus affiché comme une panne du runner.
- Batterie agentique 2.0.1 : contenu de la phrase d’abstention avec apostrophes équivalentes séparé de la reproduction exacte. Anciennes évaluations conservées.

### 3. Justesse classique

- Activation facultative de six cas structurés : deux durées, deux plans de transport/traitement et deux vecteurs Fibonacci.
- Évaluateurs originaux déterministes 1.0.0 : valeurs/conversions, dépendances d’actions et sorties numériques ; aucune recherche d’un mot isolé pour décider de la justesse.
- Statut non évalué pour prompts libres, incomplet pour réponses tronquées ; critères/version de cas dans les cartes, statistiques, assistant et exports. Aucun code généré exécuté, aucune qualité générale revendiquée.

### 4. Campagnes contrôlées

- Ollama : trois répétitions par cas, deux contextes explicites (8192/16384 proposés), température 0, même plafond de sortie, chauffe par contexte et ordre des contextes alterné entre campagnes du navigateur.
- Vérification du contexte chargé. Arrêt en cas de valeur absente/différente ; exclusion des passes non vérifiées des comparaisons contrôlées. Interruption empêche la série suivante.
- ID partagé et ordre exportés, séries sauvegardées séparément dans l’historique et conservées ensemble à l’écran. Les contrôles de paramètres et de saut/reprise sont verrouillés pendant la campagne.
- Cache géré par le runner, sans reset garanti ; cela reste une limite de comparaison.

### Validation et suite

- 15 suites automatisées passent : provenance/justesse/campagnes, télémétrie, verdicts, schémas et régression. Les flux et modèles sont simulés dans les tests automatisés ; aucune campagne réelle n’a été exécutée sur le Mac de l’utilisateur par cette mise à jour.
- README, guides techniques/backend/agentique, contrat d’export et changelog actualisés.
- Prochaine validation : modèles réels sur le Mac, trois répétitions aux deux contextes ; Exo et site communautaire ensuite.

## [0.08] — 2026-10-06

### Interface

- Quatre mesures principales par carte : TTFT, tokens/s moyens sur la durée totale, pic mémoire échantillonné avec sa source et temps total. Les valeurs inconnues restent `N/A`, y compris sur les essais en erreur.
- Volet **Toutes les métriques et conditions**, fermé au départ : tokens générés, réponse finale, mémoire moyenne/allocation déclarée, MLX, swap, E/S, contexte et chargement/cache.
- Bilan agentique visible ; critères, compteurs, cadre système, traces et téléchargements regroupés dans **Critères, outils et détails agentiques**.
- Suppression du badge mémoire redondant et grille adaptée aux petits écrans. Navigation native des volets à la souris, au toucher et au clavier.
- Collecte, historique, statistiques et contenus des exports préservés ; version producteur actualisée en 0.08.

### Documentation et maintenance

- README et guide technique actualisés. Les consignes imposent désormais une hausse de version, le changelog et les guides concernés à chaque implémentation validée.
- Validation : suites exports, agentique et schémas ; syntaxe JavaScript et contrôles de structure HTML. Pas de certification visuelle sur tous les navigateurs.

## [0.07] — 2026-10-06

### Ajouté

- Ce changelog à la racine, avec l’état des versions et l’historique vérifiable.
- Version d’application centralisée, utilisée par les libellés de l’interface et les producteurs des exports JSON/Markdown.
- Consigne de mise à jour du changelog et de la documentation pour chaque modification validée.

### Corrigé

- Le Markdown décrit désormais le schéma/version du JSON réellement inclus, y compris les bundles et rapports agentiques 2.1.0. Le JSON est construit une seule fois afin de conserver le même identifiant de rapport.
- Les anciens résultats sans version de protocole sont identifiés comme inconnus, sans leur attribuer artificiellement une version.
- Versions de l’interface, des exports et des guides harmonisées en 0.07 ; scripts modifiés rechargés avec de nouveaux paramètres de cache.

### Validation et limites

- Contrôle des versions dans les libellés HTML, exports et guides ; tests des exports et compatibilité des schémas.
- Les vérifications automatisées ne certifient pas le rendu visuel de tous les navigateurs.
- Le comparateur strict de la phrase d’abstention agentique demeure inchangé : une apostrophe différente peut faire échouer la conformité du texte malgré l’absence correcte d’appel d’outil. Cette correction fonctionnelle reste à traiter.

## [0.06] — évolutions intégrées le 2026-10-05

Plusieurs changements ont été publiés sous le même numéro d’interface 0.06. Les commits ci-dessous permettent d’identifier les étapes sans inventer de versions intermédiaires.

### Agentique approfondi

[eee2be4](https://github.com/DredGuer/LLM-Benchmarck/commit/eee2be44c1a3c96e50b10d4ffba9e0daac2ded6e)

- Batterie de six tâches : choix d’outils, rapport fichiers, reprise après erreur, clarification, changement d’objectif et abstention.
- Cadre système, appels natifs, streaming NDJSON/SSE et préservation de la conversation ; ajouts à la campagne de génération.
- Évaluations indépendantes des états, fichiers et dépendances ; objectif atteint séparé de la conformité.
- Suivi local des messages, réflexion rapportée, appels et retours ; profils statistiques par capacité.
- Export communautaire 2.1.0 sans traces, arguments bruts ni contenus des fichiers ; compatibilité 2.0.0 conservée.
- Méthodologie et limites documentées ; 14 suites automatisées validées avant publication. Les tests des adaptateurs utilisent des réponses simulées.

### Première épreuve agentique fichiers

[32b1fd5](https://github.com/DredGuer/LLM-Benchmarck/commit/32b1fd558cef7a298d635da11768800cfa139243)

- Outils fichiers restreints, vérification backend, budgets, nettoyage et statistiques de réussite séparées.
- Ancien scénario conservé pour compatibilité ; isolation applicative sans shell ni accès arbitraire aux documents utilisateur.

### Assistant, statistiques et ergonomie

- [5dbdc6a](https://github.com/DredGuer/LLM-Benchmarck/commit/5dbdc6a) : analyse de l’historique, mentions `@` des modèles et conclusions prudentes.
- [b6deaa9](https://github.com/DredGuer/LLM-Benchmarck/commit/b6deaa9) : sélection des passes, moyennes par modèle et graphiques line/area pour débit et prefill.
- [c723684](https://github.com/DredGuer/LLM-Benchmarck/commit/c723684) : panneau d’analyse opaque et champs lisibles.
- [b1f96a7](https://github.com/DredGuer/LLM-Benchmarck/commit/b1f96a7) : bulles d’aide et noms de modèles dans les fichiers JSON.
- [bec0660](https://github.com/DredGuer/LLM-Benchmarck/commit/bec0660) : une répétition par défaut, mesures fiabilisées et assistant d’analyse facultatif.
- [e085ab5](https://github.com/DredGuer/LLM-Benchmarck/commit/e085ab5) : chauffe mesurée, suivi du swap, remise à zéro des campagnes et statistiques historiques.

### Inventaire, ressources et schéma commun

- [c52316a](https://github.com/DredGuer/LLM-Benchmarck/commit/c52316a) : schéma communautaire commun, exemples Apple/agentique/Linux multi-GPU/Exo, validateurs et charte d’utilisation. Les exemples Exo et multi-GPU n’impliquent pas leur collecte ou exécution effective.
- [c6c23fe](https://github.com/DredGuer/LLM-Benchmarck/commit/c6c23fe) : inventaire Apple CPU, classes de cœurs, mémoire unifiée, GPU, SSD physiques et provenance.
- [3f0df00](https://github.com/DredGuer/LLM-Benchmarck/commit/3f0df00) : lecture des cœurs GPU Apple et transport Apple Fabric des SSD.
- Télémétrie documentée dans [APPLE_RESOURCES.md](backend/APPLE_RESOURCES.md) : swap/compression système, compteurs disque et événements MLX lorsque disponibles. Une RSS, une allocation déclarée et un pic MLX restent des mesures distinctes ; aucune vitesse maximale SSD n’est déduite.

## À suivre

- Valider les nouveaux verdicts et évaluateurs avec des campagnes réelles.
- Étendre les cas de justesse et les données de preuve après validation des six premiers cas.
- Répéter les campagnes sur modèles réels dans des conditions comparables.
- Exo et exécution distribuée restent reportés ; préparer ensuite le site communautaire et l’import validé des exports.
