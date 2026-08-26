-- Create teams table
CREATE TABLE public.teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  owner_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create players table matching CSV structure
CREATE TABLE public.players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rank INTEGER,
  overall_rank INTEGER,
  conference_rank INTEGER,
  regional_rank INTEGER,
  name TEXT NOT NULL,
  position TEXT NOT NULL,
  age DECIMAL(3,1),
  nba_team TEXT NOT NULL,
  games_played INTEGER,
  minutes_per_game DECIMAL(4,1),
  field_goals_made DECIMAL(4,1),
  field_goal_percentage DECIMAL(5,3),
  free_throw_percentage DECIMAL(5,3),
  three_pointers_made DECIMAL(4,1),
  three_point_percentage DECIMAL(5,3),
  points DECIMAL(4,1),
  total_rebounds DECIMAL(4,1),
  assists DECIMAL(4,1),
  steals DECIMAL(4,1),
  blocks DECIMAL(4,1),
  turnovers DECIMAL(4,1),
  double_doubles DECIMAL(4,1),
  total_score DECIMAL(6,2),
  is_drafted BOOLEAN DEFAULT FALSE,
  drafted_by_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  is_keeper BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create draft_picks table for managing draft order and trades
CREATE TABLE public.draft_picks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  round INTEGER NOT NULL,
  pick_number INTEGER NOT NULL,
  original_team_id UUID NOT NULL REFERENCES public.teams(id),
  current_team_id UUID NOT NULL REFERENCES public.teams(id),
  player_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  is_used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(round, pick_number)
);

-- Enable Row Level Security
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draft_picks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for teams
CREATE POLICY "Teams are viewable by everyone" 
ON public.teams FOR SELECT 
USING (true);

CREATE POLICY "Team owners can update their team" 
ON public.teams FOR UPDATE 
USING (owner_email = (SELECT email FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Authenticated users can create teams" 
ON public.teams FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- RLS Policies for profiles
CREATE POLICY "Profiles are viewable by everyone" 
ON public.profiles FOR SELECT 
USING (true);

CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- RLS Policies for players
CREATE POLICY "Players are viewable by everyone" 
ON public.players FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can update players" 
ON public.players FOR UPDATE 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert players" 
ON public.players FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- RLS Policies for draft_picks
CREATE POLICY "Draft picks are viewable by everyone" 
ON public.draft_picks FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can update draft picks" 
ON public.draft_picks FOR UPDATE 
USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert draft picks" 
ON public.draft_picks FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();