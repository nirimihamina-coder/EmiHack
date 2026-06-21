import type { Bottleneck, Intersection, Suggestion } from './types';

export class SuggestionEngine {
  generateSuggestions(
    bottlenecks: Bottleneck[],
    intersections: Map<string, Intersection>
  ): Suggestion[] {
    const suggestions: Suggestion[] = [];

    for (const bottleneck of bottlenecks) {
      const intersection = intersections.get(bottleneck.intersectionId);
      if (!intersection) continue;

      if (intersection.type === 'uncontrolled' && bottleneck.severity > 0.7) {
        suggestions.push({
          type: 'add_traffic_light',
          targetId: intersection.id,
          priority: Math.round(bottleneck.severity * 10),
          estimatedImprovement: '40-50%',
          cost: 'medium',
          description: `Installer des feux tricolores à l'intersection pour réguler le flux entre les ${bottleneck.affectedRoutes.length} routes convergentes`,
        });
      }

      if (intersection.type === 'stop' && bottleneck.severity > 0.8) {
        suggestions.push({
          type: 'add_roundabout',
          targetId: intersection.id,
          priority: Math.round(bottleneck.severity * 10),
          estimatedImprovement: '50-60%',
          cost: 'high',
          description: `Remplacer le stop par un giratoire pour fluidifier la circulation`,
        });
      }

      if (intersection.type === 'uncontrolled' && bottleneck.severity > 0.5 && bottleneck.severity <= 0.7) {
        suggestions.push({
          type: 'add_stop_sign',
          targetId: intersection.id,
          priority: 5,
          estimatedImprovement: '15-20%',
          cost: 'low',
          description: `Ajouter des panneaux stop pour réguler la priorité`,
        });
      }

      if (bottleneck.severity > 0.9) {
        suggestions.push({
          type: 'divert_traffic',
          targetId: intersection.id,
          priority: 9,
          estimatedImprovement: '15-25%',
          cost: 'low',
          description: `Mettre en place une déviation via des routes alternatives`,
        });
      }
    }

    return suggestions.sort((a, b) => b.priority - a.priority);
  }
}
