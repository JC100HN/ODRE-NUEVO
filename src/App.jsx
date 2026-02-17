import React, { useState, useEffect } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { supabase } from './supabaseClient';

function App() {
  const [fecha, setFecha] = useState(new Date());
  const [cancionesTotales, setCancionesTotales] = useState([]);
  const [planDelDia, setPlanDelDia] = useState([]);
  const [director, setDirector] = useState("");

  useEffect(() => {
    async function cargarDatos() {
      // Conexión corregida a la tabla CANCIONES
      const { data, error } = await supabase.from('CANCIONES').select('*');
      if (error) console.error("Error:", error);
      else setCancionesTotales(data || []);
    }
    cargarDatos();
  }, []);

  const agregarAlPlan = (cancion) => {
    if (!planDelDia.find(c => c.id === cancion.id)) {
      setPlanDelDia([...planDelDia, cancion]);
    }
  };

  const guardarEnBaseDeDatos = async () => {
    const fechaFormateada = fecha.toISOString().split('T')[0];
    const { error } = await supabase
      .from('planes_culto')
      .upsert({ 
        fecha: fechaFormateada, 
        director: director, 
        canciones: planDelDia 
      });

    if (error) alert("Error: " + error.message);
    else alert("¡Plan guardado para el " + fechaFormateada + "!");
  };

  return (
    <div style={{ padding: '10px', backgroundColor: '#000', color: '#fff', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <h2 style={{ color: '#3b82f6', textAlign: 'center', fontSize: '1.4rem' }}>🎸 Odre Nuevo: Gestión</h2>
      
      <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', justifyContent: 'center' }}>
        
        {/* SECCIÓN 1: CALENDARIO */}
        <div style={{ flex: '1', minWidth: '280px', backgroundColor: '#1a1a1a', padding: '15px', borderRadius: '12px' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '1rem' }}>1. Fecha del Culto</h4>
          <div style={{ color: '#000', borderRadius: '8px', overflow: 'hidden', transform: 'scale(0.95)' }}>
            <Calendar onChange={setFecha} value={fecha} />
          </div>
          <p style={{ marginTop: '10px', textAlign: 'center', fontSize: '0.9rem' }}>Día: <strong>{fecha.toLocaleDateString()}</strong></p>
          <input 
            type="text" 
            placeholder="Nombre del Director" 
            value={director}
            onChange={(e) => setDirector(e.target.value)}
            style={{ width: '90%', padding: '10px', marginTop: '5px', borderRadius: '6px', border: 'none', fontSize: '0.9rem' }}
          />
        </div>

        {/* SECCIÓN 2: PLAN Y REPERTORIO */}
        <div style={{ flex: '1', minWidth: '280px', backgroundColor: '#1a1a1a', padding: '15px', borderRadius: '12px' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '1rem' }}>2. Plan ({planDelDia.length})</h4>
          <div style={{ backgroundColor: '#222', padding: '8px', borderRadius: '8px', minHeight: '80px', marginBottom: '10px' }}>
            {planDelDia.map(c => (
              <div key={c.id} style={{ padding: '5px', borderBottom: '1px solid #333', fontSize: '0.85rem' }}>
                ✅ {c.title} <span style={{ color: '#3b82f6', fontSize: '0.75rem' }}>({c.key})</span>
              </div>
            ))}
          </div>
          
          <button onClick={guardarEnBaseDeDatos} style={{ width: '100%', padding: '12px', backgroundColor: '#22c55e', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer', marginBottom: '15px' }}>
            GUARDAR PLAN
          </button>

          <h4 style={{ margin: '0 0 10px 0', fontSize: '1rem' }}>3. Repertorio (Letra pequeña)</h4>
          <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
            {cancionesTotales.map(c => (
              <div key={c.id} style={{ backgroundColor: '#222', marginBottom: '8px', padding: '10px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ maxWidth: '75%' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '0.9rem', textTransform: 'uppercase' }}>{c.title}</div>
                  <div style={{ color: '#3b82f6', fontSize: '0.75rem' }}>Tono: {c.key} | Nota: {c.note}</div>
                </div>
                <button 
                  onClick={() => agregarAlPlan(c)} 
                  style={{ backgroundColor: '#3b82f6', color: '#fff', border: 'none', borderRadius: '5px', width: '32px', height: '32px', cursor: 'pointer', fontSize: '18px' }}
                >
                  +
                </button>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;