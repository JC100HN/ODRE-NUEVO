import React, { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { Transposer } from 'chord-transposer'
import Calendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css'

// Librerías para el reordenamiento (Drag & Drop)
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

// --- COMPONENTE: CADA CANCIÓN EN EL PLAN DEL CULTO ---
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
    border: '1px solid #333',
    backgroundColor: '#111',
    overflow: 'hidden'
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div style={estaAbierta ? estilos.acordeonHeaderActivo : estilos.acordeonHeader} onClick={() => setCancionAbierta(estaAbierta ? null : c.id)}>
        <div style={estilos.tituloAcordeon}>
          <span {...attributes} {...listeners} style={estilos.dragHandle}>☰</span>
          <span style={{color: '#4da6ff', marginRight: '8px'}}>{estaAbierta ? '▼' : '▶'}</span>
          <span style={{fontSize: '0.85rem'}}>{c.titulo}</span>
          <span style={estilos.badgeTono}>
            {transponerIndividual(c.tono || c.key, misSemitonos)}
          </span>
        </div>
        
        <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
            <div style={estilos.miniTransporte} onClick={(e) => e.stopPropagation()}>
                <button onClick={() => setMisSemitonos(s => s - 1)} style={estilos.btnXSmall}>-</button>
                <span style={{fontSize: '0.6rem', minWidth: '12px', textAlign: 'center'}}>{misSemitonos}</span>
                <button onClick={() => setMisSemitonos(s => s + 1)} style={estilos.btnXSmall}>+</button>
            </div>
            <button onClick={(e) => { e.stopPropagation(); quitarDelSetlist(c.id); }} style={estilos.btnQuitar}>×</button>
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
  const [canciones, setCanciones] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [cancionAbierta, setCancionAbierta] = useState(null)
  const [setlist, setSetlist] = useState([])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    const traerCanciones = async () => {
      const { data } = await supabase.from('CANCIONES').select('*').order('titulo', { ascending: true })
      if (data) {
        const cancionesConId = data.map((c, index) => ({
          ...c,
          id: c.id || `id-${index}-${c.titulo.substring(0,3)}`
        }))
        setCanciones(cancionesConId)
      }
    }
    traerCanciones()
  }, [])

  const agregarAlSetlist = (cancion) => {
    if (!setlist.some(item => item.id === cancion.id)) {
      setSetlist(prev => [...prev, cancion]);
    }
  }

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setSetlist((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }

  const guardarEnBaseDeDatos = async () => {
    const fechaFormateada = fecha.toISOString().split('T')[0];
    const { error } = await supabase.from('planes_culto').upsert({ 
        fecha: fechaFormateada, 
        director: director, 
        canciones: setlist 
      });
    if (error) alert("Error: " + error.message);
    else alert("¡Plan guardado para el " + fechaFormateada + "!");
  };

  const cancionesFiltradas = canciones.filter(c =>
    (c.titulo || "").toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div style={estilos.pantalla}>
      <header style={estilos.header}>
        <h2 style={estilos.logo}>🎸 Odre Nuevo</h2>
        <input 
            type="text"
            placeholder="🔍 Buscar canción..." 
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={estilos.buscador}
        />
      </header>

      <section style={{maxWidth: '800px', margin: '0 auto'}}>
        <div style={estilos.seccionCalendario}>
            <Calendar onChange={setFecha} value={fecha} />
            <p style={{fontSize: '0.8rem', marginTop: '10px'}}>Fecha: {fecha.toLocaleDateString()}</p>
            <input 
                type="text" 
                placeholder="Nombre del Director" 
                value={director}
                onChange={(e) => setDirector(e.target.value)}
                style={estilos.inputDirector}
            />
        </div>

        <h3 style={estilos.subtitulo}>📅 PLAN DEL CULTO ({setlist.length})</h3>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={setlist.map(i => i.id)} strategy={verticalListSortingStrategy}>
            {setlist.map((c) => (
              <ItemSortable
                key={`setlist-${c.id}`}
                c={c}
                cancionAbierta={cancionAbierta}
                setCancionAbierta={setCancionAbierta}
                quitarDelSetlist={(id) => setSetlist(setlist.filter(item => item.id !== id))}
              />
            ))}
          </SortableContext>
        </DndContext>

        {setlist.length > 0 && (
            <button onClick={guardarEnBaseDeDatos} style={estilos.btnGuardar}>
                💾 GUARDAR PLAN EN NUBE
            </button>
        )}

        <div style={estilos.divisor}>REPERTORIO GENERAL</div>

        <div style={estilos.grid}>
          {cancionesFiltradas.map((c) => {
            const yaEsta = setlist.some(item => item.id === c.id);
            return (
              <div key={`repo-${c.id}`} style={yaEsta ? estilos.itemRepoElegido : estilos.itemRepo}>
                <div style={{fontSize: '0.85rem'}}>{c.titulo} <span style={{fontSize: '0.7rem', color: '#4da6ff'}}>({c.tono || c.key})</span></div>
                <button onClick={() => agregarAlSetlist(c)} style={yaEsta ? estilos.btnCheck : estilos.btnPlus} disabled={yaEsta}>
                  {yaEsta ? '✓' : '+'}
                </button>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

const estilos = {
  pantalla: { backgroundColor: '#0a0a0a', color: '#fff', minHeight: '100vh', padding: '15px', fontFamily: 'sans-serif' },
  header: { marginBottom: '20px', borderBottom: '1px solid #222', paddingBottom: '10px' },
  logo: { color: '#4da6ff', margin: '0 0 10px 0', fontSize: '1.2rem', textAlign: 'center' },
  buscador: { width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #333', backgroundColor: '#1a1a1a', color: '#fff', fontSize: '0.9rem' },
  seccionCalendario: { background: '#111', padding: '15px', borderRadius: '12px', marginBottom: '20px', textAlign: 'center', color: '#000' },
  inputDirector: { width: '80%', padding: '8px', marginTop: '10px', borderRadius: '5px', border: 'none' },
  subtitulo: { color: '#888', fontSize: '0.7rem', marginBottom: '10px', letterSpacing: '1px' },
  acordeonHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: '#161616', cursor: 'pointer' },
  acordeonHeaderActivo: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: '#1a3a5a', cursor: 'pointer' },
  tituloAcordeon: { fontWeight: 'bold', display: 'flex', alignItems: 'center' },
  dragHandle: { marginRight: '10px', color: '#555', cursor: 'grab', fontSize: '1.2rem' },
  badgeTono: { color: '#4da6ff', marginLeft: '8px', background: '#000', padding: '2px 5px', borderRadius: '4px', fontSize: '0.65rem' },
  acordeonContent: { padding: '15px', background: '#050505', borderTop: '1px solid #222' },
  letra: { whiteSpace: 'pre-wrap', fontSize: '1rem', lineHeight: '1.4', fontFamily: 'monospace', color: '#ccc' },
  btnQuitar: { background: 'none', border: 'none', color: '#ff4d4d', fontSize: '1.1rem', cursor: 'pointer' },
  miniTransporte: { display: 'flex', alignItems: 'center', gap: '3px', background: '#000', padding: '2px 5px', borderRadius: '15px', border: '1px solid #333' },
  btnXSmall: { background: 'none', border: 'none', color: '#4da6ff', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem' },
  btnGuardar: { width: '100%', padding: '12px', backgroundColor: '#22c55e', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', marginTop: '10px', cursor: 'pointer' },
  divisor: { textAlign: 'center', color: '#444', margin: '30px 0 15px 0', fontSize: '0.6rem', letterSpacing: '2px' },
  grid: { display: 'flex', flexDirection: 'column', gap: '6px' },
  itemRepo: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: '#1a1a1a', borderRadius: '8px' },
  itemRepoElegido: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: '#0d1a26', borderRadius: '8px', opacity: 0.5 },
  btnPlus: { background: '#4da6ff', border: 'none', color: '#fff', width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer' },
  btnCheck: { background: 'none', border: 'none', color: '#4da6ff', fontSize: '1.1rem' }
}