export async function worktreeCommand(sub: string, args: string[]): Promise<void> {
  switch (sub) {
    case 'ls':
    case 'list':
      console.log('Worktree management: use MCP tools or daemon API.');
      console.log('MCP: baton worktree_list');
      break;
    case 'create': {
      const basePath = args.find((a) => !a.startsWith('-'));
      const branchIdx = args.indexOf('--branch');
      const branch = branchIdx >= 0 ? args[branchIdx + 1] : undefined;
      if (!basePath || !branch) {
        console.error('Usage: baton worktree create <base-path> --branch <name>');
        process.exit(1);
      }
      console.log(`Creating worktree: ${branch} from ${basePath}`);
      console.log('Use MCP tool: worktree_create');
      break;
    }
    case 'archive': {
      const path = args[0];
      if (!path) {
        console.error('Usage: baton worktree archive <path>');
        process.exit(1);
      }
      console.log(`Archiving worktree: ${path}`);
      console.log('Use MCP tool: worktree_archive');
      break;
    }
    default:
      console.log(`Usage: baton worktree <ls|create|archive>`);
  }
}
