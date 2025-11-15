import React from 'react';

type Props = {
  count: number;
  setCount: (v: number) => void;
  cardWidth: number;
  setCardWidth: (v: number) => void;
  cardPadding: number;
  setCardPadding: (v: number) => void;
  borderRadius: number;
  setBorderRadius: (v: number) => void;
  bgColor: string;
  setBgColor: (v: string) => void;
  titleColor: string;
  setTitleColor: (v: string) => void;
  valueColor: string;
  setValueColor: (v: string) => void;
  descColor: string;
  setDescColor: (v: string) => void;
  titleFontSize: number;
  setTitleFontSize: (v: number) => void;
  valueFontSize: number;
  setValueFontSize: (v: number) => void;
  descFontSize: number;
  setDescFontSize: (v: number) => void;
  shadowBlur: number;
  setShadowBlur: (v: number) => void;
};

export default function IndicatorsControls(props: Props) {
  return (
    <div style={{
      background: '#f6f7fa',
      padding: 16,
      borderRadius: 12,
      margin: '18px 0',
      boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
    }}>
      <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <label style={{ display: 'block', fontSize: 13, color: '#224' }}>Количество карточек</label>
          <input
            type="range"
            min={1}
            max={6}
            value={props.count}
            onChange={e => props.setCount(Number(e.target.value))}
            style={{ width: 220 }}
          />
          <div style={{ fontSize: 13, marginTop: 4 }}>{props.count}</div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 13 }}>Ширина карточки (px)</label>
          <input
            type="range"
            min={180}
            max={520}
            value={props.cardWidth}
            onChange={e => props.setCardWidth(Number(e.target.value))}
            style={{ width: 220 }}
          />
          <div style={{ fontSize: 13 }}>{props.cardWidth}px</div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 13 }}>Padding (px)</label>
          <input
            type="range"
            min={8}
            max={64}
            value={props.cardPadding}
            onChange={e => props.setCardPadding(Number(e.target.value))}
            style={{ width: 160 }}
          />
          <div style={{ fontSize: 13 }}>{props.cardPadding}px</div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 13 }}>Скругление (px)</label>
          <input
            type="range"
            min={0}
            max={80}
            value={props.borderRadius}
            onChange={e => props.setBorderRadius(Number(e.target.value))}
            style={{ width: 160 }}
          />
          <div style={{ fontSize: 13 }}>{props.borderRadius}px</div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 13 }}>Тень (blur)</label>
          <input
            type="range"
            min={0}
            max={80}
            value={props.shadowBlur}
            onChange={e => props.setShadowBlur(Number(e.target.value))}
            style={{ width: 160 }}
          />
          <div style={{ fontSize: 13 }}>{props.shadowBlur}px</div>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div>
            <label style={{ display: 'block', fontSize: 13 }}>Фон карточки</label>
            <input type="color" value={props.bgColor} onChange={e => props.setBgColor(e.target.value)} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13 }}>Цвет заголовка</label>
            <input type="color" value={props.titleColor} onChange={e => props.setTitleColor(e.target.value)} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13 }}>Цвет значения</label>
            <input type="color" value={props.valueColor} onChange={e => props.setValueColor(e.target.value)} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13 }}>Цвет подписи</label>
            <input type="color" value={props.descColor} onChange={e => props.setDescColor(e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div>
            <label style={{ display: 'block', fontSize: 13 }}>Размер заголовка (px)</label>
            <input type="number" min={12} max={36} value={props.titleFontSize}
                   onChange={e => props.setTitleFontSize(Number(e.target.value))} style={{ width: 70 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13 }}>Размер значения (px)</label>
            <input type="number" min={18} max={60} value={props.valueFontSize}
                   onChange={e => props.setValueFontSize(Number(e.target.value))} style={{ width: 70 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13 }}>Размер подписи (px)</label>
            <input type="number" min={10} max={22} value={props.descFontSize}
                   onChange={e => props.setDescFontSize(Number(e.target.value))} style={{ width: 70 }} />
          </div>
        </div>
      </div>
    </div>
  );
}