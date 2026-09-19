import { describe, it, expect } from 'vitest';
import { revisarFormaMinima } from './_revisarFormaMinima.js';

describe('revisarFormaMinima', () => {
  it('rechaza el argumento real de la prueba en vivo: conector sin razón', () => {
    const resultado = revisarFormaMinima('Este texto no debería presentarse porque ....');
    expect(resultado.valido).toBe(false);
    expect(resultado.motivo).toContain('porque');
  });

  it('rechaza un conector con puntos suspensivos o vacío al final', () => {
    expect(revisarFormaMinima('Deberíamos prohibirlo ya que…').valido).toBe(false);
    expect(revisarFormaMinima('La medida es injusta porque').valido).toBe(false);
  });

  it('rechaza un texto demasiado corto', () => {
    expect(revisarFormaMinima('Estoy de acuerdo').valido).toBe(false);
    expect(revisarFormaMinima('   ').valido).toBe(false);
    expect(revisarFormaMinima(undefined).valido).toBe(false);
  });

  it('un conector seguido de un punto y otra frase sigue estando vacío', () => {
    expect(revisarFormaMinima('La regla es mala porque. Además cuesta mucho dinero.').valido).toBe(false);
  });

  it('aprueba argumentos con razón, con o sin el conector literal', () => {
    expect(revisarFormaMinima('El mercado libre reduce precios porque obliga a competir.').valido).toBe(true);
    expect(revisarFormaMinima('Sin regulación aparecen monopolios que retrasan la innovación.').valido).toBe(true);
    expect(revisarFormaMinima('Debido a la inflación, los salarios pierden poder de compra.').valido).toBe(true);
  });

  it('en un debate en inglés reconoce sus conectores y no los de español', () => {
    const conectorSinRazon = 'This rule is unfair because ....';
    expect(revisarFormaMinima(conectorSinRazon, 'en').valido).toBe(false);
    expect(revisarFormaMinima(conectorSinRazon, 'en').motivo).toContain('because');
    // Sin idioma se asume español: "because" no es un conector para ese filtro.
    expect(revisarFormaMinima(conectorSinRazon).valido).toBe(true);
    expect(revisarFormaMinima('Free markets lower prices because firms must compete.', 'en').valido).toBe(true);
  });

  it('no confunde palabras que contienen el conector', () => {
    expect(revisarFormaMinima('El pórtico antiguo protege del viento en la costa.').valido).toBe(true);
  });
});
