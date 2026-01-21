import React from 'react';
import { Folder, Star, Tag, Monitor, Smartphone, Tv, Camera, PencilRuler, Image, Palette, CaseSensitive, LayoutPanelLeft, CodeXml, Bot, PanelsTopLeft, FileText, Book, BookOpen, Music, Film, Store, Shield, Wallet, Gem, Hamburger, Wheat, Cloud, Microscope, Atom, Gamepad2, Plane, Map, LayoutGrid, Search } from 'lucide-react';

const iconComponents: { [key: string]: React.ComponentType<{ size?: number }> } = {
  Folder,
  Star,
  Tag,
  Monitor,
  Smartphone,
  Tv,
  Camera,
  PencilRuler,
  Image,
  Palette,
  CaseSensitive,
  LayoutPanelLeft,
  CodeXml,
  Bot,
  PanelsTopLeft,
  FileText,
  Book,
  BookOpen,
  Music,
  Film,
  Store,
  Shield,
  Wallet,
  Gem,
  Hamburger,
  Wheat,
  Cloud,
  Microscope,
  Atom,
  Gamepad2,
  Plane,
  Map,
  LayoutGrid,
  Search,
};

interface IconProps {
  name: string;
  size?: number;
}

const Icon: React.FC<IconProps> = ({ name, size = 20 }) => {
  const IconComponent = iconComponents[name];
  if (IconComponent) {
    return <IconComponent size={size} />;
  }
  return <Folder size={size} />;
};

export default Icon;
