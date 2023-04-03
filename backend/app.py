from base.backend.app import App as BaseApp

import os
import flask

import backend
import backend.training
import backend.settings
from . import root_detection
from . import root_tracking



class App(BaseApp):
    def __init__(self, *args, **kw):
        backend.settings.ensure_pretrained_models()
        
        super().__init__(*args, path_to_deno='./deno.sh', path_to_deno_cfg='./deno.jsonc', **kw)
        if self.is_reloader:
            return


        self.route('/process_root_tracking', methods=['GET', 'POST'])(self.process_root_tracking)
        self.route('/postprocess_detection/<filename>')(self.postprocess_detection)
        self.route('/compile_tracking_results', methods=['POST'])(self.compile_tracking_results)

    def postprocess_detection(self, filename):
        #FIXME: code duplication
        full_path = os.path.join(self.cache_path, filename)
        if not os.path.exists(full_path):
            flask.abort(404)
        
        result = root_detection.postprocess_segmentation_file(full_path)
        result['segmentation'] = os.path.basename(result['segmentation'])
        result['skeleton']     = os.path.basename(result['skeleton'])
        return flask.jsonify(result)
    

    def process_root_tracking(self):
        if flask.request.method=='GET':
            fname0 = os.path.join(self.cache_path, flask.request.args['filename0'])
            fname1 = os.path.join(self.cache_path, flask.request.args['filename1'])
            result = root_tracking.process(fname0, fname1, self.settings)
        elif flask.request.method=='POST':
            data   = flask.request.get_json(force=True)
            fname0 = os.path.join(self.cache_path, data['filename0'])
            fname1 = os.path.join(self.cache_path, data['filename1'])
            result = root_tracking.process(fname0, fname1, self.settings, data)
        
        if result == root_tracking.TOO_MANY_ROOTS_ERROR:
            print('[ERROR]: TOO MANY ROOTS')
            return flask.Response("TOO_MANY_ROOTS", status=500)
        
        return flask.jsonify({
            'points0':         result['points0'].tolist(),
            'points1':         result['points1'].tolist(),
            'growthmap'     :  os.path.basename(result['growthmap']),
            'growthmap_rgba':  os.path.basename(result['growthmap_rgba']),
            'segmentation0' :  os.path.basename(result['segmentation0']),
            'segmentation1' :  os.path.basename(result['segmentation1']),
            'success'       :  result['success'],
            'n_matched_points'   : result['n_matched_points'],
            'tracking_model'     : result['tracking_model'],
            'segmentation_model' : result['segmentation_model'],
            'statistics'         : result['statistics'],
        })
    
    def compile_tracking_results(self):
        file_pairs = flask.request.get_json(force=True)['file_pairs']
        return root_tracking.compile_results_into_zip(file_pairs)

    #override    #TODO: unify
    def training(self):
        requestform  = flask.request.get_json(force=True)
        options      = requestform['options']
        if options['training_type'] not in ['detection', 'exclusion_mask']:
            raise NotImplementedError()

        imagefiles   = requestform['filenames']
        imagefiles   = [os.path.join(self.cache_path, fname) for fname in imagefiles]
        targetfiles  = backend.training.find_targetfiles(imagefiles)
        if not all([os.path.exists(fname) for fname in imagefiles]) or not all(targetfiles):
            flask.abort(404)
        
        backend.training.start_training(imagefiles, targetfiles, options, self.settings)
        return 'OK'
    
