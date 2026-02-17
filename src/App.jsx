import React, { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { Transposer } from 'chord-transposer'
import Calendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css'

// Librerías de reordenamiento
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, TouchSensor } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// --- COMPONENTE: ITEM REORDENABLE ---
function ItemSortable({ c, cancionAbierta, setCancionAbierta, quitarDelSetlist }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: c.id });
  const [misSemitonos, setMisSemitonos] = useState(0);
  const estaAbierta = cancionAbierta === c.id;

  const transponerIndividual = (texto, cantidad) => {
    if (!texto || cantidad === 0) return texto;
    try { return Transposer.transpose(texto).up(cantidad).toString(); } 
    catch (e) { return texto; }
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 1,
    opacity: isDragging ? 0.6 : 1,
    marginBottom: '8px',
    borderRadius: '8px',
    border: estaAbierta ? '1px solid #4da6ff' : '1px solid #333',
    backgroundColor: '#111',
    overflow: 'hidden',
    touchAction: 'none' // Importante para que el celular no se mueva mientras arrastras
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div style={estaAbierta ? estilos.acordeonHeaderActivo : estilos.acordeonHeader}>
        <div style={estilos.tituloAcordeon} onClick={() => setCancionAbierta(estaAbierta ? null : c.id)}>
          {/* Este icono ☰ es el que recibe los eventos de arrastre */}
          <span {...attributes} {...listeners} style={estilos.dragHandle}>☰</span>
          <div style={{display: 'flex', flexDirection: 'column'}}>
            <span style={{fontSize: '0.85rem'}}>{c.titulo} <b style={{color: '#4da6ff', fontSize: '0.75rem'}}>{transponerIndividual(c.tono || c.key, misSemitonos)}</b></span>
            <small style={{color: '#888', fontSize: '0.65rem'}}>{c.artista || 'Artista'}</small>
          </div>
        </div>
        
        <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
            <div style={estilos.miniTransporte}>
                <button onClick={() => setMisSemitonos(s => s - 1)} style={estilos.btnXSmall}>-</button>
                <span style={{fontSize: '0.7rem', color: '#fff'}}>{misSemitonos}</span>
                <button onClick={() => setMisSemitonos(s => s + 1)} style={estilos.btnXSmall}>+</button>
            </div>
            <button onClick={() => quitarDelSetlist(c.id)} style={estilos.btnQuitar}>×</button>
        </div>
      </div>
      {estaAbierta && (
        <div style={estilos.acordeonContent}>
          <pre style={estilos.letra}>{transponerIndividual(c.letra || c.lyrics, misSemitonos)}</pre>
        </div>
      )}
    </div>
  );
}

// --- COMPONENTE PRINCIPAL ---
export default function App() {
  const [fecha, setFecha] = useState(new Date());
  const [director, setDirector] = useState("");
  const [canciones, setCanciones] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [cancionAbierta, setCancionAbierta] = useState(null);
  const [setlist, setSetlist] = useState([]);

  // Configuración de sensores para detectar dedo (Touch) y mouse (Pointer)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    const traerCanciones = async () => {
      const { data } = await supabase.from('CANCIONES').select('*').order('titulo', { ascending: true })
      if (data) setCanciones(data.map((c, i) => ({ ...c, id: c.id || `id-${i}` })));
    }
    traerCanciones()
  }, []);

  useEffect(() => {
    const consultarPlan = async () => {
      const fechaISO = fecha.toISOString().split('T')[0];
      const { data } = await supabase.from('planes_culto').select('*').eq('fecha', fechaISO).maybeSingle();
      if (data) {
        setDirector(data.director || "");
        setSetlist(data.canciones || []);
      } else {
        setDirector("");
        setSetlist([]);
      }
    };
    consultarPlan();
  }, [fecha]);

  const agregarAlSetlist = (cancion) => {
    // Generamos un ID único para el setlist para que se puedan repetir canciones si es necesario
    setSetlist(prev => [...prev, { ...cancion, id: `${cancion.id}-${Date.now()}` }]);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setSetlist((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const guardarEnBaseDeDatos = async () => {
    const fechaISO = fecha.toISOString().split('T')[0];
    const { error } = await supabase.from('planes_culto').upsert({ fecha: fechaISO, director: director, canciones: setlist });
    if (error) alert("Error: " + error.message);
    else alert("¡Orden guardado correctamente!");
  };

  return (
    <div style={estilos.pantalla}>
      <h2 style={estilos.logo}>🎸 Odre Nuevo</h2>
      
      <div style={estilos.seccionCalendario}>
          <Calendar onChange={setFecha} value={fecha} className="calendario-custom" />
          <div style={{marginTop: '12px'}}>
            <input 
                type="text" placeholder="Nombre del Director..." value={director}
                onChange={(e) => setDirector(e.target.value)}
                style={estilos.inputDirector}
            />
          </div>
      </div>

      <header style={{paddingBottom: '10px'}}>
        <input type="text" placeholder="🔍 Buscar alabanza o artista..." value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)} style={estilos.buscador} />
      </header>

      <section style={{maxWidth: '500px', margin: '0 auto'}}>
        <h3 style={estilos.subtitulo}>ORDEN DEL CULTO ({setlist.length})</h3>
        
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={setlist.map(i => i.id)} strategy={verticalListSortingStrategy}>
            {setlist.map((c) => (
              <ItemSortable 
                key={c.id} 
                c={c} 
                cancionAbierta={cancionAbierta} 
                setCancionAbierta={setCancionAbierta}
                quitarDelSetlist={(id) => setSetlist(setlist.filter(item => item.id !== id))} 
              />
            ))}
          </SortableContext>
        </DndContext>

        {setlist.length > 0 && (
          <button onClick={guardarEnBaseDeDatos} style={estilos.btnGuardar}>💾 ACTUALIZAR ORDEN</button>
        )}

        <div style={estilos.divisor}>BIBLIOTECA</div>
        <div style={estilos.grid}>
          {canciones.filter(c => 
            (c.titulo || "").toLowerCase().includes(busqueda.toLowerCase()) || 
            (c.artista || "").toLowerCase().includes(busqueda.toLowerCase())
          ).map((c) => (
            <div key={c.id} style={estilos.itemRepo}>
              <div style={{display: 'flex', flexDirection: 'column'}}>
                <span style={{fontSize: '0.85rem', textTransform: 'uppercase'}}>{c.titulo}</span>
                <small style={{color: '#666', fontSize: '0.65rem'}}>{c.artista || 'Artista'}</small>
              </div>
              <button onClick={() => agregarAlSetlist(c)} style={estilos.btnPlus}>+</button>
            </div>
          ))}
        </div>
      </section>
      
      <style>{`
        .calendario-custom { width: 100% !important; border: none !important; border-radius: 12px; font-size: 0.85rem; background: white !important; color: black !important; padding: 5px; }
        .react-calendar__tile { color: black !important; padding: 12px 5px !important; }
        .react-calendar__tile--active { background: #3b82f6 !important; color: white !important; border-radius: 8px; }
        .react-calendar__navigation button { color: black !important; font-weight: bold; }
      `}</style>
    </div>
  )
}

const estilos = {
  pantalla: { backgroundColor: '#000', color: '#fff', minHeight: '100vh', padding: '12px', fontFamily: 'sans-serif' },
  logo: { color: '#4da6ff', fontSize: '1.4rem', textAlign: 'center', margin: '10px 0', fontWeight: 'bold', letterSpacing: '1px' },
  buscador: { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #333', backgroundColor: '#111', color: '#fff', fontSize: '0.9rem', boxSizing: 'border-box' },
  seccionCalendario: { background: '#fff', padding: '15px', borderRadius: '15px', marginBottom: '20px' },
  inputDirector: { width: '100%', padding: '12px', borderRadius: '8px', border: '2px solid #3b82f6', fontSize: '1rem', color: '#000', backgroundColor: '#f8fafc', boxSizing: 'border-box' },
  subtitulo: { color: '#4da6ff', fontSize: '0.7rem', marginBottom: '12px', textAlign: 'left', fontWeight: 'bold', letterSpacing: '1px' },
  acordeonHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#161616', cursor: 'pointer' },
  acordeonHeaderActivo: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#1e3a8a', cursor: 'pointer' },
  tituloAcordeon: { display: 'flex', alignItems: 'center', gap: '10px', flex: 1 },
  dragHandle: { color: '#444', cursor: 'grab', fontSize: '1.4rem', padding: '0 5px', userSelect: 'none' },
  acordeonContent: { padding: '15px', background: '#050505', borderTop: '1px solid #222' },
  letra: { whiteSpace: 'pre-wrap', fontSize: '0.9rem', lineHeight: '1.5', fontFamily: 'monospace', color: '#eee' },
  btnQuitar: { background: 'none', border: 'none', color: '#ef4444', fontSize: '1.4rem', fontWeight: 'bold', padding: '0 10px' },
  miniTransporte: { display: 'flex', alignItems: 'center', gap: '6px', background: '#000', padding: '4px 10px', borderRadius: '20px', border: '1px solid #333' },
  btnXSmall: { background: 'none', border: 'none', color: '#4da6ff', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer' },
  btnGuardar: { width: '100%', padding: '16px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', fontSize: '1rem', marginTop: '15px', cursor: 'pointer' },
  divisor: { textAlign: 'center', color: '#333', margin: '40px 0 20px 0', fontSize: '0.6rem', letterSpacing: '3px', fontWeight: 'bold' },
  grid: { display: 'flex', flexDirection: 'column', gap: '8px' },
  itemRepo: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: '#111', borderRadius: '10px', border: '1px solid #222' },
  btnPlus: { background: '#3b82f6', border: 'none', color: '#fff', width: '35px', height: '35px', borderRadius: '50%', fontSize: '1.4rem', fontWeight: 'bold' }
}