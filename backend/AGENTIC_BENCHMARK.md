# Capacités agentiques — batterie LLMB 2.0

[Prise en main](../README.md) · [Méthodologie et références](AGENTIC_METHODOLOGY.md) · [API](../BACKEND_README.md) · [Export](../schemas/README.md)

L’agentique est une **capacité à ajouter à la campagne**, aux côtés des catégories de génération. Il n’y a plus de choix exclusif « type de benchmark ». Les scores agentiques restent distincts du débit, car ces deux mesures répondent à des questions différentes.

## Démarrage

Après `git pull origin main`, arrêter l’ancien backend puis lancer `npm install` et `npm start`. Dans un second terminal à la racine :

```bash
python3 -m http.server 8001 --bind 127.0.0.1
```

Ouvrir `http://localhost:8001/llm-benchmarker.html`. Choisir Ollama, LM Studio ou llama.cpp local et un modèle/template prenant en charge les appels d’outils natifs. Cocher **Ajouter les capacités agentiques à cette campagne** et choisir les épreuves. Conserver ou désélectionner les catégories de texte : les deux peuvent être exécutées ensemble, avec une chauffe mesurée séparée.

Une répétition suffit pour vérifier le parcours. Trois répétitions aux mêmes conditions permettent de constater la variabilité ; elles ne suffisent pas à prouver une fiabilité générale. Chaque répétition reçoit un nouveau dossier et une conversation neuve par épreuve. Le cache du runner n’est pas remis à zéro ; son état agentique reste inconnu. Un modèle Ollama déchargé est réchauffé avant la mesure suivante.

## Les six épreuves

| Épreuve | Objectif donné au modèle | Vérifications indépendantes |
|---|---|---|
| Choix des outils | Retrouver une commande et soumettre son montant | Bon outil de recherche, multiplication fondée sur la commande récupérée, JSON typé exact, absence d’actions fichiers inutiles |
| Données et rapport | Produire un Markdown depuis un CSV | Source lue avant la dernière écriture, titre/tableau/totaux corrects, fichier réellement présent et relu |
| Reprise après erreur | Déterminer le stock disponible | Première lecture en panne temporaire scriptée, nouvelle lecture réussie, résultat structuré fondé sur les données lues |
| Clarification | Produire une synthèse sans devise initiale | Demande de devise avec `ask_user`, réponse scriptée EUR, écriture après précision, JSON exact et relecture |
| Changement d’objectif | Réussir un premier calcul puis adapter la tâche | Premier résultat validé, nouvelle instruction utilisateur injectée, nouvelle commande récupérée, remise calculée avant écriture, nouveau JSON exact et relu |
| Abstention | Respecter une consigne de réponse simple | Aucun appel d’outil et réponse finale exactement conforme |

Les tâches et données sont originales au projet et versionnées, dans `backend/agentic-suite.js`. Ce n’est pas une exécution de BFCL, τ-bench ou ToolSandbox, et les scores ne sont pas comparables à leurs classements. La clarification et le second tour sont **scriptés**, pas produits par un utilisateur simulé par IA. Les outils incluent des possibilités inutiles pour certaines demandes : le modèle doit faire un choix.

## Cadre système et protocole

Chaque épreuve commence par un message système fixe : appels natifs, schémas JSON stricts, dépendances à respecter, données à lire, entrées protégées, clarification des informations manquantes, reprise des erreurs explicitement temporaires, prise en compte des nouvelles instructions et absence d’outil inutile. Le message utilisateur décrit un objectif ; il ne fournit plus une recette imposant chaque appel.

La carte permet de déplier **le cadre système et les schémas reçus**. Les outils offerts sont `lookup_order`, `calculate`, `list_directory`, `read_file`, `create_directory`, `write_file`, `ask_user` et `submit_result`. Types, paramètres requis, valeurs autorisées et champs supplémentaires sont vérifiés par le backend. `submit_result.result` doit être un objet, pas du JSON dans une chaîne ; sa structure est spécifique aux tâches qui le demandent.

Ollama utilise `/api/chat` en NDJSON. LM Studio/llama.cpp utilisent `/v1/chat/completions` en SSE. Les champs de réflexion, texte et appels sont accumulés puis renvoyés dans la conversation avec les résultats d’outils. **Aucun outil n’est exécuté sur un tour tronqué ou sans confirmation de fin.** Les appels d’un tour complet sont exécutés séquentiellement. L’adaptateur conserve leurs identifiants pour les réponses compatibles.

## Visibilité en direct

Le panneau de suivi distingue préparation/chauffe, attente du modèle, réflexion rapportée, texte, préparation des appels, arguments, exécution, retours d’outils, nouvelle instruction utilisateur et vérification finale. Le code n’invente aucun raisonnement caché. Si le runner ne rapporte pas de réflexion, cette absence est indiquée ; elle ne signifie pas que le modèle ne raisonne pas.

Les traces locales sont limitées à 160 événements et 65 536 caractères par résultat ; chaque entrée est plafonnée à 16 000 caractères. Une troncature est signalée. Les fichiers créés et le journal sont conservés dans l’historique local, soumis au quota navigateur, et les fichiers peuvent être téléchargés depuis la carte. Ni ces contenus ni les arguments/réflexions bruts ne sont inclus dans le JSON communautaire ou le contexte de l’assistant. Le rapport Markdown ajoute les critères et étapes mais pas ce journal.

## Scores et temps

**Objectif atteint** vérifie les états et livrables attendus. **Exécution conforme** exige en plus les critères de protocole, pertinence, périmètre et budgets. Un bon fichier après un appel mal typé peut donc avoir un objectif atteint et une conformité échouée. Chaque critère reste visible ; `null` signifie non sollicité, pas un échec ni une preuve de capacité. Les tâches qui n’utilisent aucun outil ne prouvent pas le respect d’un format d’appel natif.

Les statistiques regroupent les mêmes modèles, tâches, versions et conditions. Elles présentent les taux de conformité, détails de passes et profils par capacité. Les taux par capacité portent sur les **critères évalués** ; une capacité peut avoir plusieurs critères. Les échecs restent dans le dénominateur. Les courbes de génération excluent les tâches agentiques. Une reprise est un nouvel appel du même outil après rejet, et non le rejet lui-même.

Le temps total inclut orchestration, échanges modèle, outils et vérification, mais exclut la finalisation de télémétrie. Le premier segment peut être du texte, de la réflexion ou un appel ; le premier appel exécuté est mesuré séparément. Le TTFT agentique concerne le premier tour, pas chaque requête prise isolément. Le débit cumule les sorties de plusieurs échanges : il ne mesure pas la qualité agentique. Prefill et durée de génération sont additionnés lorsqu’Ollama les rapporte. Le comptage du runner est préféré à l’estimation. Si le dernier tour est incomplet, le total de tokens de la tâche reste inconnu, sans faire passer un compteur partiel pour un total.

RSS et télémétrie existantes restent disponibles avec Ollama ; ce parcours ne collecte pas les ressources de LM Studio/llama.cpp. Thinking et réponse ne sont pas comptés séparément sans compteurs fiables.

## Budgets et isolation

Par épreuve : **12 tours modèle, 24 appels d’outils, 4 minutes**, 25 étapes backend avec la vérification finale. **Tokens max** est un budget cumulé de sortie, avec au plus 2 048 tokens demandés par tour et le solde restant. Si le comptage est estimé, ce plafond n’est pas une garantie exacte de tokens. Les entrées en contexte augmentent avec la conversation ; le runner conserve le contexte Auto.

Les seuls chemins sont les entrées synthétiques `inputs/orders.csv`, `inputs/stock.json` et les sorties `outputs/report.md`, `outputs/summary.json`, `outputs/report.json`. Les entrées sont en lecture seule pour les outils. Sorties de 8 192 octets maximum ; liens symboliques, traversées de chemin, fichiers alternatifs et outils non déclarés sont rejetés. Aucun shell, réseau d’outil ni accès aux documents personnels. Le runner local est joint pour l’inférence.

Les restrictions sont **applicatives**, sans sandbox OS ni protection contre un processus ayant les mêmes droits utilisateur. Les routes requièrent loopback, origine locale si présente, en-tête dédié et jeton de session. Huit sessions v2 maximum ; les routes historiques v1 conservent leur propre limite. Fin, abandon et expiration nettoient le dossier. Un crash backend peut laisser un petit dossier temporaire ; aucun effacement après crash n’est garanti. Le bouton d’arrêt interrompt la campagne et demande une évaluation en échec/nettoyage.

## Exports, versions et validation

Le protocole est `agentic-suite-2.0.0`, avec scénario/évaluateur 2.0.0 et export communautaire **2.1.0** pour les rapports contenant ces épreuves. Le validateur accepte encore 2.0.0 et les historiques restent lisibles. Les nouveaux champs sont scénario, critères, objectif atteint, premier appel et nombre de tours ; les empreintes de fichiers remplacent leur contenu dans l’export.

Le parcours fichiers v1 est conservé côté backend pour compatibilité et dans les anciennes cartes ; il n’est plus proposé comme nouvelle campagne. Les nouvelles scores ne sont pas agrégés avec lui.

```bash
node backend/agentic-harness.test.cjs
node backend/agentic-suite.test.cjs
node backend/agentic-stream.test.cjs
node backend/agentic-integration.test.cjs
node schemas/test.cjs
```

Les tests utilisent de vrais dossiers/fichiers, avec réponses modèle simulées pour les adaptateurs. Ils vérifient les six tâches et leurs échecs, causalité observable, scores, annulation, flux fragmentés/incomplets, isolation, nettoyage, historique mixte et confidentialité des exports. Une validation avec des modèles réels sur votre machine reste indispensable. Ces tâches vérifient des comportements observables ; elles ne prouvent pas une capacité générale de raisonnement ou d’autonomie.

Exo est reporté. Après validation de cette batterie, le site communautaire pourra importer les rapports, comparer les mêmes tâches/versions et distinguer réussite fonctionnelle, conformité et performances matérielles.
