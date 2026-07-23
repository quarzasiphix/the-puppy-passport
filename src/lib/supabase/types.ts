// Hand-written stub covering the tables this pass's UI actually queries. Once the local stack is
// running, replace this file by running `npm run db:types` (wired to `supabase gen types
// typescript --local`), which produces the full, authoritative Database type for every table in
// the schema. Shape matches what that command outputs, so no import needs to change afterwards.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          first_name: string | null;
          last_name: string | null;
          email: string | null;
          phone: string | null;
          avatar_url: string | null;
          preferred_language: string;
          preferred_currency: string;
          country: string | null;
          city: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & { id: string };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
        Relationships: [];
      };
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role:
            | "customer"
            | "buyer"
            | "animal_owner"
            | "breeder"
            | "foundation_member"
            | "shelter_member"
            | "operations"
            | "driver"
            | "moderator"
            | "admin";
          status: "pending" | "active" | "suspended" | "rejected";
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["user_roles"]["Row"]> & {
          user_id: string;
          role: Database["public"]["Tables"]["user_roles"]["Row"]["role"];
        };
        Update: Partial<Database["public"]["Tables"]["user_roles"]["Row"]>;
        Relationships: [];
      };
      organisations: {
        Row: {
          id: string;
          org_type:
            | "kennel"
            | "foundation"
            | "shelter"
            | "rescue"
            | "transport_company"
            | "kennel_club"
            | "other";
          name: string;
          slug: string;
          logo_url: string | null;
          cover_image_url: string | null;
          description: string | null;
          country: string | null;
          city: string | null;
          public_location: string | null;
          private_address_id: string | null;
          association_name: string | null;
          membership_number: string | null;
          registration_number: string | null;
          years_experience: number | null;
          response_time: string | null;
          transport_available: boolean;
          international_transport_available: boolean;
          verification_status: "pending" | "approved" | "rejected" | "suspended";
          is_public: boolean;
          owner_user_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["organisations"]["Row"]> & {
          owner_user_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["organisations"]["Row"]>;
        Relationships: [];
      };
      organisation_members: {
        Row: {
          id: string;
          org_id: string;
          profile_id: string;
          member_role:
            | "owner"
            | "administrator"
            | "employee"
            | "breeder"
            | "volunteer"
            | "driver"
            | "viewer"
            | "adoption_coordinator"
            | "transport_coordinator"
            | "animal_care_member";
          status: "active" | "suspended";
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["organisation_members"]["Row"]> & {
          org_id: string;
          profile_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["organisation_members"]["Row"]>;
        Relationships: [];
      };
      organisation_invitations: {
        Row: {
          id: string;
          org_id: string;
          invited_email: string;
          invited_role: Database["public"]["Tables"]["organisation_members"]["Row"]["member_role"];
          token: string;
          status: "pending" | "accepted" | "declined" | "revoked" | "expired";
          invited_by: string;
          expires_at: string;
          accepted_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["organisation_invitations"]["Row"]> & {
          org_id: string;
          invited_email: string;
          invited_role: Database["public"]["Tables"]["organisation_members"]["Row"]["member_role"];
          invited_by: string;
        };
        Update: Partial<Database["public"]["Tables"]["organisation_invitations"]["Row"]>;
        Relationships: [];
      };
      user_verifications: {
        Row: {
          id: string;
          user_id: string;
          verification_type:
            | "email"
            | "phone"
            | "identity"
            | "breeder"
            | "organisation"
            | "animal_ownership"
            | "driver"
            | "transport_employee";
          status:
            | "not_started"
            | "pending"
            | "more_information_required"
            | "approved"
            | "rejected"
            | "expired"
            | "suspended";
          submitted_data: Json;
          evidence_url: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["user_verifications"]["Row"]> & {
          user_id: string;
          verification_type: Database["public"]["Tables"]["user_verifications"]["Row"]["verification_type"];
        };
        Update: Partial<Database["public"]["Tables"]["user_verifications"]["Row"]>;
        Relationships: [];
      };
      private_addresses: {
        Row: {
          id: string;
          owner_user_id: string | null;
          owner_org_id: string | null;
          country: string;
          postal_code: string | null;
          city: string;
          street: string | null;
          building_number: string | null;
          apartment: string | null;
          latitude: number | null;
          longitude: number | null;
          address_label: string | null;
          is_verified: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["private_addresses"]["Row"]> & {
          country: string;
          city: string;
        };
        Update: Partial<Database["public"]["Tables"]["private_addresses"]["Row"]>;
        Relationships: [];
      };
      animals: {
        Row: {
          id: string;
          listing_category: "breeder_puppy" | "adoption" | "private_rehoming" | "not_listed";
          litter_id: string | null;
          organization_id: string | null;
          owner_profile_id: string | null;
          name: string;
          slug: string | null;
          breed_id: string | null;
          sex: "male" | "female" | null;
          color: string | null;
          date_of_birth: string | null;
          approximate_age: string | null;
          weight_kg: number | null;
          size_category: "small" | "medium" | "large" | "giant" | null;
          microchip_number: string | null;
          tattoo_number: string | null;
          registry_country: string | null;
          registry_name: string | null;
          registry_reference: string | null;
          identification_verified_status: string;
          price: number | null;
          currency: string | null;
          description: string | null;
          temperament: string | null;
          ideal_home: string | null;
          health_tests: unknown;
          is_published: boolean;
          availability_status: string;
          transport_available: boolean;
          international_transport_available: boolean;
          is_featured: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["animals"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["animals"]["Row"]>;
        Relationships: [];
      };
      breeds: {
        Row: {
          id: string;
          name: string;
          slug: string;
          size_category: "small" | "medium" | "large" | "giant";
          short_description: string | null;
          image_url: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["breeds"]["Row"]> & {
          name: string;
          slug: string;
        };
        Update: Partial<Database["public"]["Tables"]["breeds"]["Row"]>;
        Relationships: [];
      };
      parent_dogs: {
        Row: {
          id: string;
          kennel_id: string;
          breed_id: string | null;
          registered_name: string;
          call_name: string | null;
          sex: "male" | "female";
          date_of_birth: string | null;
          color: string | null;
          pedigree_number: string | null;
          microchip_number: string | null;
          description: string | null;
          profile_image_url: string | null;
          health_tests: Json;
          titles: string | null;
          is_active: boolean;
        };
        Insert: Partial<Database["public"]["Tables"]["parent_dogs"]["Row"]> & {
          kennel_id: string;
          registered_name: string;
          sex: "male" | "female";
        };
        Update: Partial<Database["public"]["Tables"]["parent_dogs"]["Row"]>;
        Relationships: [];
      };
      litters: {
        Row: {
          id: string;
          kennel_id: string;
          breed_id: string | null;
          code: string;
          mother_id: string | null;
          father_id: string | null;
          birth_date: string | null;
          expected_birth_date: string | null;
          ready_date: string | null;
          puppy_count: number | null;
          male_count: number | null;
          female_count: number | null;
          description: string | null;
          association: string | null;
          registration_number: string | null;
          status: string;
          is_published: boolean;
        };
        Insert: Partial<Database["public"]["Tables"]["litters"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["litters"]["Row"]>;
        Relationships: [];
      };
      achievements: {
        Row: {
          id: string;
          parent_dog_id: string;
          kennel_id: string;
          title: string;
          issuing_body: string | null;
          achieved_on: string | null;
          evidence_url: string | null;
          verification_status: "pending" | "approved" | "rejected";
          admin_notes: string | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["achievements"]["Row"]> & {
          parent_dog_id: string;
          kennel_id: string;
          title: string;
        };
        Update: Partial<Database["public"]["Tables"]["achievements"]["Row"]>;
        Relationships: [];
      };
      buyer_applications: {
        Row: {
          id: string;
          animal_id: string;
          litter_id: string | null;
          buyer_id: string;
          organization_id: string | null;
          application_type: "purchase" | "adoption" | "rehoming_inquiry";
          buyer_city: string | null;
          buyer_country: string | null;
          phone: string | null;
          housing_type: "house" | "apartment" | null;
          has_garden: boolean | null;
          has_children: boolean | null;
          children_ages: string | null;
          other_animals: string | null;
          previous_experience: string | null;
          breed_knowledge: string | null;
          working_schedule: string | null;
          alone_time: string | null;
          intended_purpose: string | null;
          collection_method: "pickup" | "domestic_transport" | "international_transport" | null;
          transport_required: boolean;
          preferred_collection_date: string | null;
          message: string | null;
          status:
            | "submitted"
            | "under_review"
            | "more_info_requested"
            | "call_requested"
            | "waiting_list"
            | "approved"
            | "rejected"
            | "withdrawn"
            | "converted_to_reservation";
          breeder_response: string | null;
          submitted_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["buyer_applications"]["Row"]> & {
          animal_id: string;
          buyer_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["buyer_applications"]["Row"]>;
        Relationships: [];
      };
      reservations: {
        Row: {
          id: string;
          animal_id: string;
          litter_id: string | null;
          buyer_id: string;
          organization_id: string;
          application_id: string;
          status: "awaiting_buyer" | "awaiting_breeder" | "confirmed" | "cancelled" | "completed";
          agreed_price: number | null;
          currency: string | null;
          deposit_amount: number | null;
          deposit_status: "not_required" | "pending" | "paid";
          agreement_status: "not_sent" | "sent" | "signed";
          planned_collection_date: string | null;
          collection_method: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["reservations"]["Row"]> & {
          animal_id: string;
          buyer_id: string;
          organization_id: string;
          application_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["reservations"]["Row"]>;
        Relationships: [];
      };
      rehoming_reviews: {
        Row: {
          id: string;
          animal_id: string;
          owner_profile_id: string;
          reason_for_rehoming: string;
          ownership_declaration: boolean;
          admin_status: "pending" | "approved" | "rejected";
          admin_notes: string | null;
          reviewed_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["rehoming_reviews"]["Row"]> & {
          animal_id: string;
          owner_profile_id: string;
          reason_for_rehoming: string;
        };
        Update: Partial<Database["public"]["Tables"]["rehoming_reviews"]["Row"]>;
        Relationships: [];
      };
      routes: {
        Row: {
          id: string;
          route_number: string | null;
          route_name: string;
          departure_date: string | null;
          origin_country: string | null;
          origin_region: string | null;
          destination_countries: string[];
          destination_regions: string[];
          planned_stops: Json;
          vehicle_id: string | null;
          driver_id: string | null;
          max_capacity: number;
          internal_cost_estimate: number | null;
          customer_revenue_estimate: number | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["routes"]["Row"]> & { route_name: string };
        Update: Partial<Database["public"]["Tables"]["routes"]["Row"]>;
        Relationships: [];
      };
      route_waitlist: {
        Row: {
          id: string;
          profile_id: string;
          origin_country: string;
          destination_country: string;
          earliest_date: string | null;
          latest_date: string | null;
          notes: string | null;
          status: "open" | "matched" | "cancelled";
          matched_route_id: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["route_waitlist"]["Row"]> & {
          profile_id: string;
          origin_country: string;
          destination_country: string;
        };
        Update: Partial<Database["public"]["Tables"]["route_waitlist"]["Row"]>;
        Relationships: [];
      };
      route_stops: {
        Row: {
          id: string;
          route_id: string;
          stop_order: number;
          city: string | null;
          country: string | null;
          stop_type: "pickup" | "dropoff" | "rest";
          planned_time: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["route_stops"]["Row"]> & {
          route_id: string;
          stop_order: number;
        };
        Update: Partial<Database["public"]["Tables"]["route_stops"]["Row"]>;
        Relationships: [];
      };
      route_assignments: {
        Row: {
          id: string;
          route_id: string;
          transport_request_id: string;
          compatibility_checked: boolean;
          compatibility_notes: string | null;
          reservation_status:
            | "temporarily_held"
            | "waiting_for_customer_action"
            | "confirmed"
            | "expired"
            | "released"
            | "cancelled";
          hold_expires_at: string | null;
          assigned_at: string;
          assigned_by: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["route_assignments"]["Row"]> & {
          route_id: string;
          transport_request_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["route_assignments"]["Row"]>;
        Relationships: [];
      };
      transport_parties: {
        Row: {
          id: string;
          transport_request_id: string;
          party_role:
            | "legal_owner"
            | "requester"
            | "sender"
            | "recipient"
            | "payer"
            | "pickup_contact"
            | "delivery_contact";
          profile_id: string | null;
          organisation_id: string | null;
          external_name: string | null;
          external_phone: string | null;
          external_email: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["transport_parties"]["Row"]> & {
          transport_request_id: string;
          party_role: Database["public"]["Tables"]["transport_parties"]["Row"]["party_role"];
        };
        Update: Partial<Database["public"]["Tables"]["transport_parties"]["Row"]>;
        Relationships: [];
      };
      transport_request_animals: {
        Row: {
          id: string;
          transport_request_id: string;
          position: number;
          animal_id: string | null;
          name: string | null;
          breed_free_text: string | null;
          sex: "male" | "female" | null;
          approximate_age: string | null;
          weight_kg: number | null;
          size_category: "small" | "medium" | "large" | "giant" | null;
          microchip_number: string | null;
          microchip_known: boolean;
          passport_available: boolean | null;
          vaccination_status: string | null;
          rabies_vaccination_date: string | null;
          health_condition: string | null;
          medication: string | null;
          behavioural_notes: string | null;
          anxiety_or_aggression_notes: string | null;
          can_travel_with_others: boolean | null;
          crate_requirements: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["transport_request_animals"]["Row"]> & {
          transport_request_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["transport_request_animals"]["Row"]>;
        Relationships: [];
      };
      transport_request_amendments: {
        Row: {
          id: string;
          transport_request_id: string;
          requested_by: string;
          field_name: string;
          old_value: string | null;
          new_value: string;
          status: "pending" | "approved" | "rejected";
          review_note: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["transport_request_amendments"]["Row"]> & {
          transport_request_id: string;
          requested_by: string;
          field_name: string;
          new_value: string;
        };
        Update: Partial<Database["public"]["Tables"]["transport_request_amendments"]["Row"]>;
        Relationships: [];
      };
      transport_requests: {
        Row: {
          id: string;
          request_number: string;
          requester_profile_id: string;
          request_purpose: string;
          ownership_changing: boolean;
          animal_id: string | null;
          animal_name: string | null;
          breed_free_text: string | null;
          sex: "male" | "female" | null;
          approximate_age: string | null;
          weight_kg: number | null;
          size_category: "small" | "medium" | "large" | "giant" | null;
          microchip_number: string | null;
          microchip_known: boolean;
          passport_available: boolean | null;
          vaccination_status: string | null;
          rabies_vaccination_date: string | null;
          health_condition: string | null;
          medication: string | null;
          behavioural_notes: string | null;
          anxiety_or_aggression_notes: string | null;
          can_travel_with_others: boolean | null;
          crate_requirements: string | null;
          current_owner_profile_id: string | null;
          sender_org_id: string | null;
          sender_profile_id: string | null;
          recipient_profile_id: string | null;
          release_authorized_by: string | null;
          receive_authorized_by: string | null;
          payer_profile_id: string | null;
          pickup_country: string | null;
          pickup_city: string | null;
          pickup_area_approx: string | null;
          pickup_address_exact: string | null;
          destination_country: string | null;
          destination_city: string | null;
          destination_area_approx: string | null;
          destination_address_exact: string | null;
          earliest_date: string | null;
          latest_date: string | null;
          flexible_dates: boolean;
          delivery_type: "home_delivery" | "meeting_point";
          number_of_animals: number;
          is_domestic: boolean | null;
          is_sale: boolean | null;
          is_ownership_change: boolean | null;
          is_adoption: boolean | null;
          travelling_with_owner: boolean | null;
          owner_travel_within_5_days: boolean | null;
          sender_is_registered_breeder: boolean | null;
          sender_is_verified_org: boolean | null;
          origin_registered_or_approved: boolean | null;
          has_passport: boolean | null;
          has_microchip: boolean | null;
          rabies_valid: boolean | null;
          health_certificate_required: boolean | null;
          traces_notification_required: boolean | null;
          destination_treatment_required: boolean | null;
          medically_fit_for_transport: boolean | null;
          compliance_review_result: string;
          requested_service_type: "shared" | "individual" | "express" | "vip" | "recommend_best";
          confirmed_accurate: boolean;
          confirmed_authority: boolean;
          confirmed_will_provide_documents: boolean;
          confirmed_understands_review: boolean;
          confirmed_understands_publication_not_confirmation: boolean;
          status: string;
          visibility: "private" | "community_visible";
          assigned_route_id: string | null;
          assigned_vehicle_id: string | null;
          assigned_driver_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["transport_requests"]["Row"]> & {
          requester_profile_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["transport_requests"]["Row"]>;
        Relationships: [];
      };
      transport_status_history: {
        Row: {
          id: string;
          transport_request_id: string;
          status: string;
          changed_at: string;
          changed_by: string | null;
          internal_note: string | null;
          customer_note: string | null;
          evidence_url: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["transport_status_history"]["Row"]> & {
          transport_request_id: string;
          status: string;
        };
        Update: Partial<Database["public"]["Tables"]["transport_status_history"]["Row"]>;
        Relationships: [];
      };
      transport_documents: {
        Row: {
          id: string;
          transport_request_id: string;
          transport_party_id: string | null;
          category: string;
          file_url: string | null;
          status: string;
          uploaded_by: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          notes: string | null;
          expiry_date: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["transport_documents"]["Row"]> & {
          transport_request_id: string;
          category: string;
        };
        Update: Partial<Database["public"]["Tables"]["transport_documents"]["Row"]>;
        Relationships: [];
      };
      welfare_cases: {
        Row: {
          id: string;
          case_number: string | null;
          organisation_id: string;
          created_by: string;
          animal_id: string | null;
          animal_name: string | null;
          animal_description: string | null;
          reason: string;
          urgency: "routine" | "urgent" | "critical";
          location_country: string | null;
          location_city: string | null;
          location_area_approx: string | null;
          location_address_exact: string | null;
          destination_country: string | null;
          destination_city: string | null;
          deadline: string | null;
          welfare_notes: string | null;
          contact_name: string | null;
          contact_phone: string | null;
          status:
            | "draft"
            | "submitted"
            | "under_review"
            | "information_required"
            | "accepted_for_assessment"
            | "declined"
            | "converted_to_transport"
            | "closed";
          ops_acknowledged: boolean;
          ops_acknowledged_by: string | null;
          ops_acknowledged_at: string | null;
          review_notes: string | null;
          converted_transport_request_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["welfare_cases"]["Row"]> & {
          organisation_id: string;
          created_by: string;
          reason: string;
        };
        Update: Partial<Database["public"]["Tables"]["welfare_cases"]["Row"]>;
        Relationships: [];
      };
      welfare_case_documents: {
        Row: {
          id: string;
          welfare_case_id: string;
          file_url: string;
          uploaded_by: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["welfare_case_documents"]["Row"]> & {
          welfare_case_id: string;
          file_url: string;
        };
        Update: Partial<Database["public"]["Tables"]["welfare_case_documents"]["Row"]>;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          profile_id: string;
          notification_type: string;
          title: string;
          body: string | null;
          link_url: string | null;
          is_read: boolean;
          created_at: string;
          actor_profile_id: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["notifications"]["Row"]> & {
          profile_id: string;
          notification_type: string;
          title: string;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Row"]>;
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          actor_profile_id: string | null;
          action: string;
          target_type: string;
          target_id: string | null;
          before: Json | null;
          after: Json | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["audit_logs"]["Row"]> & {
          action: string;
          target_type: string;
        };
        Update: Partial<Database["public"]["Tables"]["audit_logs"]["Row"]>;
        Relationships: [];
      };
      vehicles: {
        Row: {
          id: string;
          name: string;
          registration_number: string | null;
          vehicle_type: string | null;
          active: boolean;
          crates: Json;
          ventilation_info: string | null;
          temperature_monitoring: boolean;
          camera_available: boolean;
          cleaning_status: string | null;
          last_service_date: string | null;
          next_service_date: string | null;
          authorisation_notes: string | null;
          document_expiry_date: string | null;
          internal_notes: string | null;
          make: string | null;
          model: string | null;
          year: number | null;
          country_of_registration: string | null;
          insurance_expiry_date: string | null;
          last_cleaning_date: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["vehicles"]["Row"]> & { name: string };
        Update: Partial<Database["public"]["Tables"]["vehicles"]["Row"]>;
        Relationships: [];
      };
      drivers: {
        Row: {
          id: string;
          profile_id: string | null;
          name: string;
          contact: string | null;
          availability_status: string | null;
          internal_verification_status: string;
          training_documents: Json;
          document_expiry_date: string | null;
          emergency_contact: string | null;
          internal_notes: string | null;
          home_region: string | null;
          qualification_status: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["drivers"]["Row"]> & { name: string };
        Update: Partial<Database["public"]["Tables"]["drivers"]["Row"]>;
        Relationships: [];
      };
      groups: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          group_type: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["groups"]["Row"]> & {
          name: string;
          slug: string;
        };
        Update: Partial<Database["public"]["Tables"]["groups"]["Row"]>;
        Relationships: [];
      };
      group_members: {
        Row: {
          id: string;
          group_id: string;
          profile_id: string;
          role: "member" | "moderator";
          joined_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["group_members"]["Row"]> & {
          group_id: string;
          profile_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["group_members"]["Row"]>;
        Relationships: [];
      };
      posts: {
        Row: {
          id: string;
          author_profile_id: string | null;
          author_organization_id: string | null;
          post_type: string;
          content: string | null;
          visibility: "public" | "followers" | "group";
          group_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["posts"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["posts"]["Row"]>;
        Relationships: [];
      };
      comments: {
        Row: {
          id: string;
          post_id: string;
          author_profile_id: string;
          content: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["comments"]["Row"]> & {
          post_id: string;
          author_profile_id: string;
          content: string;
        };
        Update: Partial<Database["public"]["Tables"]["comments"]["Row"]>;
        Relationships: [];
      };
      reactions: {
        Row: {
          id: string;
          post_id: string | null;
          comment_id: string | null;
          profile_id: string;
          reaction_type: "like" | "support" | "helpful";
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["reactions"]["Row"]> & {
          profile_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["reactions"]["Row"]>;
        Relationships: [];
      };
      follows: {
        Row: {
          id: string;
          follower_profile_id: string;
          followed_profile_id: string | null;
          followed_organization_id: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["follows"]["Row"]> & {
          follower_profile_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["follows"]["Row"]>;
        Relationships: [];
      };
      pricing_rules: {
        Row: {
          id: string;
          rule_type: string;
          applies_to: string | null;
          amount: number;
          is_percentage: boolean;
          currency: string;
          active: boolean;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["pricing_rules"]["Row"]> & {
          rule_type: string;
          amount: number;
        };
        Update: Partial<Database["public"]["Tables"]["pricing_rules"]["Row"]>;
        Relationships: [];
      };
      reports: {
        Row: {
          id: string;
          reporter_profile_id: string;
          target_type: "animal_listing" | "organisation" | "post" | "message" | "user";
          target_id: string;
          reason:
            | "suspected_illegal_breeding"
            | "false_breeder_information"
            | "stolen_animal"
            | "missing_or_false_microchip"
            | "animal_welfare_concern"
            | "misleading_health_information"
            | "scam_or_payment_fraud"
            | "duplicate_listing"
            | "prohibited_content"
            | "other";
          evidence_url: string | null;
          description: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["reports"]["Row"]> & {
          reporter_profile_id: string;
          target_type: string;
          target_id: string;
          reason: string;
        };
        Update: Partial<Database["public"]["Tables"]["reports"]["Row"]>;
        Relationships: [];
      };
      moderation_cases: {
        Row: {
          id: string;
          report_id: string | null;
          case_type: string;
          target_type: "animal_listing" | "organisation" | "post" | "message" | "user";
          target_id: string;
          status: "open" | "investigating" | "resolved" | "dismissed";
          assigned_moderator_id: string | null;
          decision: string | null;
          decision_explanation: string | null;
          appeal_status: "none" | "requested" | "reviewed";
          created_at: string;
          resolved_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["moderation_cases"]["Row"]> & {
          case_type: string;
          target_type: string;
          target_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["moderation_cases"]["Row"]>;
        Relationships: [];
      };
      quotations: {
        Row: {
          id: string;
          transport_request_id: string;
          service_type: string;
          pickup: string | null;
          destination: string | null;
          planned_date_range: string | null;
          estimated_route: string | null;
          base_price: number | null;
          optional_services: Json;
          total_price: number | null;
          currency: string;
          expiry_date: string | null;
          assumptions: string | null;
          document_conditions: string | null;
          cancellation_conditions: string | null;
          status: "draft" | "sent" | "viewed" | "accepted" | "rejected" | "expired" | "replaced";
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["quotations"]["Row"]> & {
          transport_request_id: string;
          service_type: string;
        };
        Update: Partial<Database["public"]["Tables"]["quotations"]["Row"]>;
        Relationships: [];
      };
      saved_animals: {
        Row: {
          id: string;
          buyer_id: string;
          animal_id: string;
          saved_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["saved_animals"]["Row"]> & {
          buyer_id: string;
          animal_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["saved_animals"]["Row"]>;
        Relationships: [];
      };
      account_deletion_requests: {
        Row: {
          id: string;
          profile_id: string;
          reason: string | null;
          status: "pending" | "processed" | "declined";
          requested_at: string;
          processed_at: string | null;
          processed_by: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["account_deletion_requests"]["Row"]> & {
          profile_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["account_deletion_requests"]["Row"]>;
        Relationships: [];
      };
      transport_reviews: {
        Row: {
          id: string;
          transport_request_id: string;
          reviewer_profile_id: string;
          rating: number;
          driver_rating: number | null;
          would_recommend: boolean | null;
          comment: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["transport_reviews"]["Row"]> & {
          transport_request_id: string;
          reviewer_profile_id: string;
          rating: number;
        };
        Update: Partial<Database["public"]["Tables"]["transport_reviews"]["Row"]>;
        Relationships: [];
      };
      transport_incidents: {
        Row: {
          id: string;
          transport_request_id: string;
          reported_by: string;
          incident_type:
            | "delay"
            | "vehicle_breakdown"
            | "animal_welfare_concern"
            | "accident"
            | "document_issue"
            | "weather"
            | "other";
          severity: "low" | "medium" | "high" | "critical";
          description: string;
          status: "open" | "investigating" | "resolved";
          resolution_notes: string | null;
          occurred_at: string;
          resolved_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["transport_incidents"]["Row"]> & {
          transport_request_id: string;
          reported_by: string;
          incident_type: string;
          description: string;
        };
        Update: Partial<Database["public"]["Tables"]["transport_incidents"]["Row"]>;
        Relationships: [];
      };
      conversations: {
        Row: {
          id: string;
          subject: string | null;
          linked_transport_request_id: string | null;
          linked_animal_id: string | null;
          conversation_type: "transport" | "marketplace" | "adoption" | "community" | "support";
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["conversations"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["conversations"]["Row"]>;
        Relationships: [];
      };
      conversation_participants: {
        Row: {
          id: string;
          conversation_id: string;
          profile_id: string;
          role_in_conversation:
            | "requester"
            | "ops"
            | "buyer"
            | "breeder"
            | "adopter"
            | "foundation"
            | "sender"
            | "recipient"
            | "member";
        };
        Insert: Partial<Database["public"]["Tables"]["conversation_participants"]["Row"]> & {
          conversation_id: string;
          profile_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["conversation_participants"]["Row"]>;
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_profile_id: string;
          body: string;
          message_kind:
            | "customer_info"
            | "document_request"
            | "quotation"
            | "scheduling_update"
            | "internal_note"
            | "handover_instruction"
            | "general";
          is_internal: boolean;
          attachment_url: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["messages"]["Row"]> & {
          conversation_id: string;
          sender_profile_id: string;
          body: string;
        };
        Update: Partial<Database["public"]["Tables"]["messages"]["Row"]>;
        Relationships: [];
      };
      fundraising_campaigns: {
        Row: {
          id: string;
          organisation_id: string;
          animal_id: string;
          buyer_application_id: string;
          transport_request_id: string;
          quotation_id: string;
          title: string;
          description: string | null;
          target_amount: number;
          currency: string;
          deadline: string | null;
          status:
            | "draft"
            | "organisation_review"
            | "approved"
            | "active"
            | "target_reached"
            | "partially_funded"
            | "expired"
            | "transport_cancelled"
            | "suspended"
            | "completed"
            | "refund_review";
          excess_funds_policy: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["fundraising_campaigns"]["Row"]> & {
          organisation_id: string;
          animal_id: string;
          buyer_application_id: string;
          transport_request_id: string;
          quotation_id: string;
          title: string;
          target_amount: number;
        };
        Update: Partial<Database["public"]["Tables"]["fundraising_campaigns"]["Row"]>;
        Relationships: [];
      };
      fundraising_contributions: {
        Row: {
          id: string;
          campaign_id: string;
          supporter_profile_id: string;
          amount: number;
          currency: string;
          display_publicly: boolean;
          public_message: string | null;
          payment_status: "pending" | "completed" | "failed" | "refunded";
          is_simulated: boolean;
          payment_provider_reference: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["fundraising_contributions"]["Row"]> & {
          campaign_id: string;
          supporter_profile_id: string;
          amount: number;
        };
        Update: Partial<Database["public"]["Tables"]["fundraising_contributions"]["Row"]>;
        Relationships: [];
      };
      // Every other table exists in the database (see supabase/migrations) but doesn't have a
      // hand-written type yet — `npm run db:types` replaces this whole file once Docker is
      // running locally. (Deliberately no catch-all index signature here: mixing one in with the
      // explicit keys above collapses supabase-js's generic inference for every table to `never`.)
    };
    Views: {
      public_transport_requests: {
        Row: {
          id: string;
          request_number: string;
          request_purpose: string;
          pickup_country: string | null;
          pickup_area_approx: string | null;
          destination_country: string | null;
          destination_area_approx: string | null;
          earliest_date: string | null;
          latest_date: string | null;
          flexible_dates: boolean;
          requested_service_type: string;
          size_category: string | null;
          breed_free_text: string | null;
          status: string;
          created_at: string;
        };
        Relationships: [];
      };
      driver_transport_job_view: {
        Row: {
          id: string;
          request_number: string | null;
          status: string;
          pickup_country: string | null;
          pickup_city: string | null;
          pickup_area_approx: string | null;
          pickup_address_exact: string | null;
          destination_country: string | null;
          destination_city: string | null;
          destination_area_approx: string | null;
          destination_address_exact: string | null;
          earliest_date: string | null;
          latest_date: string | null;
          flexible_dates: boolean;
          delivery_type: string;
          animal_name: string | null;
          breed_free_text: string | null;
          sex: string | null;
          weight_kg: number | null;
          size_category: string | null;
          crate_requirements: string | null;
          behavioural_notes: string | null;
          anxiety_or_aggression_notes: string | null;
          can_travel_with_others: boolean | null;
          release_authorized_by: string | null;
          receive_authorized_by: string | null;
          assigned_driver_id: string | null;
          assigned_route_id: string | null;
          assigned_vehicle_id: string | null;
        };
        Relationships: [];
      };
      public_routes: {
        Row: {
          id: string;
          route_number: string | null;
          route_name: string;
          departure_date: string | null;
          origin_country: string | null;
          origin_region: string | null;
          destination_countries: string[];
          destination_regions: string[];
          status: string;
          max_capacity: number;
          available_capacity: number;
        };
        Relationships: [];
      };
      public_transport_rating: {
        Row: {
          average_rating: number | null;
          review_count: number;
        };
        Relationships: [];
      };
      public_fundraising_contributions: {
        Row: {
          id: string;
          campaign_id: string;
          amount: number;
          currency: string;
          public_message: string | null;
          created_at: string;
        };
        Relationships: [];
      };
      public_fundraising_totals: {
        Row: {
          campaign_id: string;
          total_collected: number;
        };
        Relationships: [];
      };
    };
    Functions: {
      approve_user_verification: {
        Args: { p_verification_id: string; p_admin_notes?: string | null };
        Returns: string;
      };
      get_my_profile: {
        Args: Record<PropertyKey, never>;
        Returns: Database["public"]["Tables"]["profiles"]["Row"];
      };
      start_application_conversation: {
        Args: { p_animal_id: string; p_buyer_id?: string | null };
        Returns: string;
      };
      start_transport_conversation: {
        Args: { p_transport_request_id: string };
        Returns: string;
      };
      create_transport_draft: {
        Args: { p_request: Json; p_animals?: Json; p_parties?: Json };
        Returns: string;
      };
      request_transport_amendment: {
        Args: { p_transport_request_id: string; p_field_name: string; p_new_value: string };
        Returns: string;
      };
      review_transport_amendment: {
        Args: { p_amendment_id: string; p_approve: boolean; p_review_note?: string | null };
        Returns: undefined;
      };
      acknowledge_welfare_case: {
        Args: { p_case_id: string };
        Returns: undefined;
      };
      review_welfare_case: {
        Args: {
          p_case_id: string;
          p_decision: "accepted_for_assessment" | "declined" | "information_required";
          p_review_notes?: string | null;
        };
        Returns: undefined;
      };
      convert_welfare_case_to_transport_draft: {
        Args: { p_case_id: string };
        Returns: string;
      };
      invite_org_member: {
        Args: {
          p_org_id: string;
          p_email: string;
          p_role: Database["public"]["Tables"]["organisation_members"]["Row"]["member_role"];
        };
        Returns: string;
      };
      revoke_org_invitation: {
        Args: { p_invitation_id: string };
        Returns: undefined;
      };
      get_invitation_by_token: {
        Args: { p_token: string };
        Returns: {
          org_name: string;
          org_type: string;
          invited_role: Database["public"]["Tables"]["organisation_members"]["Row"]["member_role"];
          expires_at: string;
        }[];
      };
      accept_org_invitation: {
        Args: { p_token: string };
        Returns: undefined;
      };
      decline_org_invitation: {
        Args: { p_token: string };
        Returns: undefined;
      };
      remove_org_member: {
        Args: { p_member_id: string };
        Returns: undefined;
      };
      set_org_member_status: {
        Args: { p_member_id: string; p_status: "active" | "suspended" };
        Returns: undefined;
      };
      change_org_member_role: {
        Args: {
          p_member_id: string;
          p_new_role: Database["public"]["Tables"]["organisation_members"]["Row"]["member_role"];
        };
        Returns: undefined;
      };
      leave_organisation: {
        Args: { p_org_id: string };
        Returns: undefined;
      };
    };
  };
}
