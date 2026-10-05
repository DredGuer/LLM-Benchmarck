# Méthodologie agentique et sources

Recherche et intégration : 5 octobre 2026. [Batterie exécutée](AGENTIC_BENCHMARK.md).

La première tâche fichiers démontrait des opérations, mais prescrivait leur ordre et donnait seulement un verdict global. Elle ne distinguait pas suffisamment sélection, format, dépendances, reprise ou dialogue. La batterie 2.0 teste ces comportements avec un message système, des schémas d’outils, des objectifs utilisateur et des états vérifiés indépendamment.

| Source primaire étudiée | Principe retenu | Application dans LLMB |
|---|---|---|
| [BFCL V3 : multi-turn et multi-step](https://gorilla.cs.berkeley.edu/blogs/13_bfcl_v3_multi_turn.html) | Les dépendances, informations manquantes et objectifs successifs doivent être évalués au-delà d’un appel isolé | Recherche puis calcul, clarification et changement de commande ; lecture tardive insuffisante |
| [BFCL V4 : formats](https://gorilla.cs.berkeley.edu/blogs/17_bfcl_v4_prompt_variation.html) | Le format et le contexte d’appel influencent les résultats ; ils doivent être identifiables | Cadre système versionné, arguments typés et checks de conformité séparés de l’objectif |
| [τ-bench : papier](https://arxiv.org/abs/2406.12045) et [évaluateurs actuels](https://github.com/sierra-research/tau2-bench/blob/main/docs/evaluation.md) | Vérifier l’état final et les règles ; distinguer une réussite ponctuelle de la fiabilité répétée | Contrôles déterministes des données/livrables, 1 passe pour démarrer puis répétitions comparables, échecs conservés |
| [ToolSandbox : recherche Apple](https://machinelearning.apple.com/research/toolsandbox-stateful-conversational-llm-benchmark) et [code](https://github.com/apple-aiml-research/ToolSandbox) | L’usage des outils dépend de l’état et de jalons successifs, avec interactions et erreurs | Évidence enregistrée à l’écriture/soumission, panne temporaire scriptée et nouvelle instruction |
| [Terminal-Bench : présentation](https://www.tbench.ai/news/announcement) | Une déclaration de l’agent ne suffit pas ; les tâches ont un environnement et des tests de réussite | Fichiers réels et vérification backend. Aucun shell ajouté : les environnements conteneurisés de Terminal-Bench ne sont pas intégrés ici |
| [Ollama : streaming](https://docs.ollama.com/capabilities/streaming) et [appels d’outils](https://docs.ollama.com/capabilities/tool-calling) | Accumuler texte, réflexion et appels, puis fournir les retours dans la conversation | NDJSON, préservation des champs rapportés et exécution après fin complète du tour |
| [LM Studio : outils](https://lmstudio.ai/docs/developer/openai-compat/tools) | Respecter le protocole compatible, assemblage des fragments et identifiants de calls | SSE, arguments JSON reconstruits, `tool_call_id` et contrôles backend |

## Ce que les scores permettent de conclure

Ils indiquent que **ce modèle, ce runner/template, ces paramètres et cet orchestrateur** ont satisfait ou échoué des critères de ces tâches. La réussite fonctionnelle peut différer de la conformité du protocole. Le nombre de tentatives, version de tâche, état de chargement, cache inconnu et paramètres sont conservés pour limiter les comparaisons abusives.

Les profils sont des taux de critères évalués, pas un quotient d’intelligence. Les critères non sollicités restent inconnus. Les textes de réflexion affichés ne constituent pas une preuve d’un raisonnement interne fidèle ; les scores reposent sur les appels, leur format, les dépendances observables et les états finaux.

## Limites assumées

- Six tâches originales, synthétiques et publiques ; elles ne couvrent pas recherche web, programmation autonome, horizons longs ou tous les outils réels. La mémorisation des données fixes n’est pas exclue.
- Dialogue utilisateur scripté, pas une simulation libre. L’exécution des appels est séquentielle ; le parallélisme de l’agent n’est pas évalué.
- Vérifications structurées/déterministes ; pas d’évaluation générale de la prose ou de la qualité sémantique d’un raisonnement.
- Aucune adaptation ni copie des datasets officiels. Aucun résultat officiel BFCL/τ-bench/ToolSandbox/Terminal-Bench ne doit être revendiqué.
- Aucun `pass@k` ou `pass^k` annoncé : les petites séries locales et le cache partagé ne justifient pas de transformer un simple taux observé en garantie statistique de fiabilité.
- Les adaptateurs sont testés avec réponses simulées ; les modèles réels doivent être essayés sur la machine de l’utilisateur.

## Validation pratique

Sur le même Mac, choisir deux modèles compatibles, même quantification/contextes/réglages lorsque possible. Lancer les six épreuves une fois, vérifier les critères et traces, puis trois répétitions. Comparer capacité par capacité et tâche par tâche. Un format refusé peut provenir du modèle ou du template/runner : les versions et traces aident au diagnostic, sans attribuer automatiquement une cause.

## Extensions ultérieures

Ajouter des tâches et variantes versionnées, de nouvelles fixtures et évaluateurs, puis une validation sur machines/modèles réels. Une extension aux shells, au réseau ou à des tâches arbitraires devra avoir une isolation adaptée avant exécution. Exo et l’exécution distribuée restent reportés ; le prochain chantier prioritaire est le site communautaire et l’import d’exports validés.
