export function getV4AnsiblePostgresConfiguration(systemSchemaPath: string,
                                                  systemDataPath: string,
                                                  foodsSnapshotPath: string): string {
    return `
intake24:
  admin_user_email: admin
  system_database:
    user: intake24
    name: intake24_system
    schema_snapshot_path: ${systemSchemaPath}
    data_snapshot_path: ${systemDataPath}
  food_database:
    user: intake24
    name: intake24_foods
    snapshot_path: ${foodsSnapshotPath}
  create_test_databases: true  

# Basic settings
postgresql_version: 12
postgresql_encoding: 'UTF-8'
postgres_admin_user: postgres

postgresql_locale_parts:
  - 'en_GB' # Locale
  - 'UTF-8' # Encoding

postgresql_users:
  - name: "{{intake24.system_database.user}}"
  - name: "{{intake24.food_database.user}}"

postgresql_pg_hba_default: []

# pg_hba.conf
postgresql_pg_hba_custom:
  - comment: "Allow Unix socket connections for '{{postgresql_service_user}}' and 'deploy'"
    type: local
    database: all
    user: "{{postgresql_admin_user}}"
    address: ''
    method: 'peer map=postgres'
  - comment: "Allow passwordless connections from any host to system DB"
    type: host
    database: "{{intake24.system_database.name}}"
    user: "{{intake24.system_database.user}}"
    address: "all"
    method: "trust"
  - comment: "Allow passwordless connections from any host to food DB"
    type: host
    database: "{{intake24.food_database.name}}"
    user: "{{intake24.food_database.user}}"
    address: "all"
    method: "trust"
  - comment: "Allow passwordless connections from any host to system test DB"
    type: host
    database: "{{intake24.system_database.name}}_test"
    user: "{{intake24.system_database.user}}"
    address: "all"
    method: "trust"
  - comment: "Allow passwordless connections from any host to food test DB"
    type: host
    database: "{{intake24.food_database.name}}_test"
    user: "{{intake24.food_database.user}}"
    address: "all"
    method: "trust"    

# pg_ident.conf
postgresql_pg_ident:
    - comment: "Map deploy user to postgresql admin"
      mapname: "postgres"
      system_username: "deploy"
      pg_username: "{{postgresql_admin_user}}"
    - comment: "Map system postgresql user to postgresql admin"
      mapname: "postgres"
      system_username: "{{postgresql_service_user}}"
      pg_username: "{{postgresql_admin_user}}"

# postgresql.conf
postgresql_listen_addresses:
  - "*"

postgresql_ssl: off
postgresql_logging_collector: on
postgresql_log_statement: all
`;
}
